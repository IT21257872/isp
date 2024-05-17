const mongoose = require("mongoose");

const DatabaseConnection = () => {
  try {
    const MONGO_URL =
      "mongodb+srv://mohanmalika99:sd6tD4Epd4ZfvTPc@cluster0.xcvaaeu.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

    const connectToMongo = async () => {
      await mongoose.connect(MONGO_URL);
      console.log("Connected to MongoDB");
    };

    connectToMongo();
  } catch (error) {
    console.log("Database connection failed", error);
  }
};

module.exports = { DatabaseConnection };
