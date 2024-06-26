const express = require("express");
const router = express.Router();
const IpList = require("../Models/IpListModal");
const { banIP } = require("../utlis/ipUtils");
const fs = require("fs");
const { exec } = require("child_process");
const chokidar = require("chokidar");
const winston = require("winston");
const nodemailer = require("nodemailer");

router.get("/", async (req, res) => {
  try {
    const ipList = await IpList.find();
    if (!ipList) {
      res.status(400).send({ error: "No IpList Found", success: false });
    } else {
      res.send(ipList);
    }
  } catch (err) {
    res.send(err);
  }
});

router.post("/post", async (req, res) => {
  const ipList = new IpList({
    ip: req.body.ip,
    username: req.body.username,
    attempts: req.body.attempts,
    status: req.body.status,
  });

  try {
    const savedIpList = await ipList.save();
    res.json(savedIpList);
  } catch (err) {
    res.status(500).json({ message: "Error saving IpList", error: err });
  }
});

//change the status of the ip address

router.put("/:id", async (req, res) => {
  try {
    const updatedIpList = await IpList.updateOne(
      { _id: req.params.id },
      { $set: { status: req.body.status } }
    );
    res.json(updatedIpList);
  } catch (err) {
    res.json({ message: err });
  }
});

router.post("/banip", (req, res) => {
  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message }) =>
          `${timestamp} - ${level.toUpperCase()} - ${message}`
      )
    ),
    transports: [new winston.transports.Console()],
  });

  const failedAttempts = {};

  const findLogFile = (possiblePaths) => {
    for (const filePath of possiblePaths) {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
    }
    throw new Error("None of the specified log files exist.");
  };

  const saveIPToDB = async (ipAddress, username, status, attempts) => {
    try {
      // Check if the IP address is already present in the database
      const existingIp = await IpList.findOne({ ip: ipAddress });
      if (existingIp) {
        // If the IP address is already present in the database, update the attempts and status
        // existingIp.attempts = attempts ? attempts : existingIp.attempts + 1
        // existingIp.attempts = attempts
        //   ? parseInt(attempts)
        //   : existingIp.attempts + 1;

        // Inside saveIPToDB function
        existingIp.attempts = attempts
          ? parseInt(existingIp.attempts) + parseInt(attempts)
          : existingIp.attempts + 1;

        existingIp.status = "Banned";
        await existingIp.save();
        return;
      }
      // If the IP address is not present in the database, create a new entry
      else {
        const ipList = new IpList({
          ip: ipAddress,
          username: username,
          attempts: 1, // Assuming this is the first attempt when saving to the database
          status: status, // You can set status as 'blocked' or any other value as per your requirement
        });
        await ipList.save();
      }
    } catch (err) {
      console.error("Error saving IP to database:", err);
    }
  };

  const banIP = (ipAddress, username) => {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: "mohanmalika99@gmail.com",
        pass: "khhg bead phmw fbhv",
      },
    });

    const mailOptions = {
      from: "mohanmalika99@gmail.com",
      to: "mohanmalika99@gmail.com",
      subject: "SSHield - IP Banned",
      text: `The IP address ${ipAddress} has been blocked due to multiple failed login attempts..`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending email: ", error);
      } else {
        console.log("Email sent: ", info.response);
      }
    });

    exec(
      `sudo iptables -A INPUT -s ${ipAddress} -j DROP`,
      (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error banning IP: ${error.message}`);
          res.status(500).json({ message: "Error banning IP", error: error });
          return;
        }
        if (stderr) {
          logger.error(`Stderr: ${stderr}`);
          res.status(500).json({ message: "Error banning IP", error: stderr });
          return;
        }
        logger.info(`Banned IP: ${ipAddress}`);
        // res.json({ message: `IP ${ipAddress} banned successfully` });
        // saveIPToDB(ipAddress, username, 5, "Banned");
      }
    );
  };
  const banIPs = (ipAddress) => {
    exec(
      `sudo iptables -A INPUT -s ${ipAddress} -j DROP`,
      (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error banning IP: ${error.message}`);
          return;
        }
        if (stderr) {
          logger.error(`Stderr: ${stderr}`);
          return;
        }
        logger.info(`Banned IP: ${ipAddress}`);
      }
    );
  };

  const monitorSSHLog = (logFilePath) => {
    logger.info("Starting to monitor SSH log...");

    const failedPattern =
      /Failed \w+ for (invalid user )?(?<username>\S+) from (?<ipAddress>\S+)/;
    const successPattern =
      /Accepted \w+ for (?<username>\S+) from (?<ipAddress>\S+)/;

    const watcher = chokidar.watch(logFilePath, {
      persistent: true,
      usePolling: true,
      interval: 1000,
    });

    watcher.on("change", (filePath) => {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const lastLine = lines[lines.length - 2]; // Second last line to account for empty line at end

      // console.log(lastLine, "lastLine__________________________________");
      // console.log(
      //   lines[lines.length - 1],
      //   "++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++1"
      // );
      // console.log(
      //   lines[lines.length - 2],
      //   "++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++2"
      // );
      // console.log(
      //   lines[lines.length - 3],
      //   "+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++3"
      // );

      const failedMatch = failedPattern.exec(lastLine);
      const successMatch = successPattern.exec(lastLine);

      if (failedMatch) {
        const { ipAddress, username } = failedMatch.groups;
        saveIPToDB(ipAddress, username, "Failed");
        logger.info(
          `Detected failed login attempt from IP=${ipAddress}, Username=${username}`
        );
        console.log(
          `Detected failed login attempt: IP=${ipAddress}, Username=${username}`
        );

        // Track failed attempts
        const currentTime = Date.now();
        if (!failedAttempts[ipAddress]) {
          failedAttempts[ipAddress] = [];
        }

        failedAttempts[ipAddress].push(currentTime);

        // Filter out attempts older than 1 minute
        failedAttempts[ipAddress] = failedAttempts[ipAddress].filter(
          (time) => currentTime - time <= 60000
        );
        if (failedAttempts[ipAddress].length > 3) {
          saveIPToDB(
            ipAddress,
            username,
            "Banned",
            failedAttempts[ipAddress].length
          );
          banIP(ipAddress);
          delete failedAttempts[ipAddress]; // Clear failed attempts after banning
        }
      } else if (successMatch) {
        const { ipAddress, username } = successMatch.groups;
        saveIPToDB(ipAddress, username, "Success");
        logger.info(`Successful login: Username=${username}, IP=${ipAddress}`);
        console.log(`Successful login: Username=${username}, IP=${ipAddress}`);
      }
    });
  };

  const possibleLogPaths = [
    "/var/log/auth.log",
    "/var/log/secure",
    "/var/log/messages",
  ];

  try {
    const logFilePath = findLogFile(possibleLogPaths);
    monitorSSHLog(logFilePath);
    res.json({ message: "Monitoring SSH log for failed login attempts" });
  } catch (error) {
    logger.error(error.message);
    res.status(500).json({ message: "Error", error: error.message });
  }
});

router.post("/unblockip", async (req, res) => {
  const { ipAddress } = req.body;

  const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.printf(
        ({ timestamp, level, message }) =>
          `${timestamp} - ${level.toUpperCase()} - ${message}`
      )
    ),
    transports: [new winston.transports.Console()],
  });

  try {
    // Check if the IP address is already in the database and marked as banned
    // const bannedIp = await IpList.findOne({ ip: ipAddress, status: "Banned" });
    // const existingIp = await IpList.findOne({ ip: ipAddress });

    // if (!bannedIp) {
    //   return res.status(400).json({ message: "IP address is not currently banned." });
    // }

    // Execute the command to remove the IP from the firewall rules
    const existingIp = await IpList.findOne({ ip: ipAddress });
    existingIp.status = "Unblocked";
    existingIp.save();

    exec(
      `sudo iptables -D INPUT -s ${ipAddress} -j DROP`,
      (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error unblocking IP: ${error.message}`);
          return res
            .status(500)
            .json({ message: "Error unblocking IP", error: error });
        }
        if (stderr) {
          logger.error(`Stderr: ${stderr}`);
          return res
            .status(500)
            .json({ message: "Error unblocking IP", error: stderr });
        }
        logger.info(`Unblocked IP: ${ipAddress}`);
        return res.json({ message: `IP ${ipAddress} unblocked successfully` });
      }
    );
  } catch (err) {
    logger.error("Error unblocking IP:", err);
    res.status(500).json({ message: "Error unblocking IP", error: err });
  }
});

router.post("/search", async (req, res) => {
  const { ipAddress } = req.body;

  try {
    const ipList = await IpList.find({
      ip: { $regex: ipAddress, $options: "i" },
    });
    if (ipList.length === 0) {
      res.status(200).send({ data: [], success: false });
    } else {
      res.status(200).send({ data: ipList, success: true });
    }
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

module.exports = router;
