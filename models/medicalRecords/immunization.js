const mongoose = require("mongoose");

const ImmunizationsSchema = new mongoose.Schema({
  medicalInfoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalInfo",
    required: true,
  },
  userId: {
    //who made changes
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  vaccine: {
    type: String,
    required: true,
  },
  remarks: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Immunization", ImmunizationsSchema);
