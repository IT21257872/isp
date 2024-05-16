const { exec } = require("child_process");
const winston = require("winston");

// Configure logging
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
  return new Promise((resolve, reject) => {
    exec(
      `sudo iptables -A INPUT -s ${ipAddress} -j DROP`,
      (error, stdout, stderr) => {
        if (error) {
          logger.error(`Error banning IP: ${error.message}`);
          reject(error);
          return;
        }
        if (stderr) {
          logger.error(`Stderr: ${stderr}`);
          reject(new Error(stderr));
          return;
        }
        logger.info(`Banned IP: ${ipAddress}`);
        resolve();
      }
    );
  });
};

module.exports = { banIP };
