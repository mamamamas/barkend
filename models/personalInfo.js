const mongoose = require("mongoose");

const personalInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  firstName: {
    type: String,
    default: "N/A",
  },
  lastName: {
    type: String,
    default: "N/A",
  },
  dateOfBirth: {
    type: Date,
    default: null,
  },
  sex: {
    type: String,
    enum: ["Male", "Female"], // Enum values
    default: null,
  },
  civilStatus: {
    type: String,
    enum: ["Single", "Married", "Divorced", "Widowed"], // Enum values
    default: "Single", // Default value
  },
  address: {
    type: String,
    default: "N/A",
  },
  religion: {
    type: String,
    default: "N/A",
  },
  telNo: {
    type: String,
    default: "N/A",
  },
  guardian: {
    type: String,
    default: "N/A",
  },
  guardianAddress: {
    type: String,
    default: "N/A",
  },
  guardianTelNo: {
    type: String,
    default: "N/A",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("PersonalInfo", personalInfoSchema);
