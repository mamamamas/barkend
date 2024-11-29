const mongoose = require("mongoose");

const followUpSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  userId: {
    //who made the record
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  followUpComplaints: {
    type: String,
    required: true,
  },
  followUpActions: {
    type: String,
    required: true,
  },
});

const assessmentSchema = new mongoose.Schema({
  medicalInfoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalInfo",
    required: true,
  },
  userId: {
    //who made the record
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  complaints: {
    type: String,
    required: true,
  },
  actions: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  followUps: followUpSchema, // Object of follow-up sub-documents
});

module.exports = mongoose.model("Assessment", assessmentSchema);
