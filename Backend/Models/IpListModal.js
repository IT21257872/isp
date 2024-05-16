const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const IPListSchema = new Schema(
  {
    ip: {
      type: String,
      required: true,
    },
    username: {
      type: String,
    },
    attempts: {
      type: String,
    },
    status: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const ipList = mongoose.model("IPList", IPListSchema);

module.exports = ipList;
