const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const User = require("../Models/UsersModel");

router.post("/register", async (req, res) => {
  try {
    const user_data = {
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      confirmPass: req.body.confirmPass,
    };

    const email = await User.findOne({
      email: user_data.email,
    });
    if (email) {
      res.status(400).send({ error: "Email Already Exists", success: false });
      return -1;
    }

    const hashedPassword = await bcrypt.hash(user_data.password, 10);

    const user = {
      username: req.body.username,
      email: req.body.email,
      password: hashedPassword,
    };
    const newUser = new User(user);
    await newUser.save();
    res.send({ newUser, success: true });
  } catch (err) {
    res.send(err);
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = req.body.email;
    const password = req.body.password;

    const result = await User.findOne({ email: email });
    if (!result) {
      res.status(200).send({ error: "No User Found", success: false });
    } else {
      const valid = await bcrypt.compare(password, result.password);
      if (!valid) {
        res
          .status(200)
          .send({ error: "Wrong Password or Email", success: false });
      } else {
        res.send({
          success: true,
          userId: result.id,
          username: result.username,
          email: result.email,
        });
      }
    }
  } catch (err) {
    res.send(err);
  }
});

router.get("/all-users", async (req, res) => {
  try {
    const users = await User.find();
    if (!users) {
      res.status(400).send({ error: "No Users Found", success: false });
    } else {
      res.send(users);
    }
  } catch (err) {
    res.send(err);
  }
});

router.delete("/delete/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const deleteUser = await User.findByIdAndDelete(id);
    if (!deleteUser) {
      res.status(404).send({ error: "User not found", success: false });
    } else {
      res.send({ deleteUser, success: true });
    }
  } catch (err) {
    res.send(err);
  }
});

router.put("/update", async (req, res) => {
  try {
    const id = req.body.id;
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    const updateUser = {
      username: req.body.username,
      email: req.body.email,
      phone: req.body.phone,
      password: hashedPassword,
    };

    const UpdateUser = await User.findByIdAndUpdate(id, updateUser);
    if (!UpdateUser) {
      res.status(404).send({ error: "User Update Failed", success: false });
    } else {
      res.send({ UpdateUser, success: true });
    }
  } catch (err) {
    res.send(err);
  }
});
module.exports = router;
