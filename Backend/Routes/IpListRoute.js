const express = require("express");
const router = express.Router();
const IpList = require("../Models/IpListModal");
const { banIP } = require("../utlis/ipUtils");

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
  const ipAddress = req.body.ipAddress;
  banIP(ipAddress)
    .then(() => res.json({ message: `IP ${ipAddress} banned successfully` }))
    .catch((err) => res.status(500).json({ message: err.message }));
});

module.exports = router;
