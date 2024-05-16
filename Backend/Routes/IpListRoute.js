const express = require("express");
const router = express.Router();
const IpList = require("../Models/IpListModal");
const { banIP } = require("../utlis/ipUtils");
const fs = require("fs");
const { exec } = require("child_process");
const chokidar = require("chokidar");
const winston = require("winston");

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

  const banIP = (ipAddress) => {
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
        res.json({ message: "IP banned successfully", ipAddress: ipAddress });
      }
    );
  };

  const monitorSSHLog = async (logFilePath) => {
    logger.info("Starting to monitor SSH log...");
    const failedPattern = /Failed \w+ for (invalid user )?(?<username>\S+) from (?<ipAddress>\S+)/;
    const watcher = chokidar.watch(logFilePath, {
      persistent: true,
      usePolling: true,
      interval: 1000,
    });

    watcher.on("change", async (filePath) => {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const lastLine = lines[lines.length - 2]; // Second last line to account for empty line at end
      const failedMatch = failedPattern.exec(lastLine);

      if (failedMatch) {
        const { ipAddress, username } = failedMatch.groups;
        logger.info(`Detected failed login attempt from IP=${ipAddress}, Username=${username}`);
        try {
          // Save to database
          const ipList = new IpList({
            ip: ipAddress,
            username: username,
            attempts: 1,
            status: "Failed",
          });
          const savedIpList = await ipList.save();
          logger.info(`IpList ${ipAddress} saved successfully-failed`);
        } catch (err) {
          logger.error("Error saving IpList", err);
        }

        banIP(ipAddress);
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
  } catch (error) {
    logger.error(error.message);
    res.status(500).json({ message: "Error finding log file", error: error.message });
  }
});


module.exports = router;
