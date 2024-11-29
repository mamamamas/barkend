const mongoose = require("mongoose");

const requestFormSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  formName: {
    type: String,
    enum: [
      "Appointment",
      "Medical Leave Form",
      "Medical Record Request",
      "Special Leave Form",
      "Telehealth",
      "Parental Consent",
      "Student Absence Form",
    ],
    required: true,
  },
  appointmentDate: {
    type: Date,
  },
  leave: {
    startDate: {
      type: Date, // Change to String
    },
    endDate: {
      type: Date, // Change to String
    },
  },
  releaseRecordTo: {
    type: String,
  },
  reason: {
    type: String,
  },
  medicalCert: {
    type: String,
  },
  releaseMedRecordto: {
    type: String,
  },
  supportingDoc: {
    type: String,
  },
  //parental consent
  guardianName: {
    type: String,
  },
  guardianConsent: {
    type: String,
  },
  eSignature: {
    type: String,
  },
  //Student Absence
  dateOfAbsence: {
    type: Date,
  },
  //Special Leave
  additionalReason: {
    type: String,
  },
  //telehealth
  telehealthType: {
    type: String,
  },

  status: {
    type: String,
    enum: ["pending", "approved", "declined", "completed"],
    default: "pending",
  },
  handledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  feedback: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("RequestForm", requestFormSchema);
