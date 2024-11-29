const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    //who made the notif
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  title: String,
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  documentType: {
    type: String,
    enum: [
      "post",
      "request",
      "event",
      "Appointment",
      "Medical Leave Form",
      "Medical Record Request",
      "Special Leave Form",
      "Referral Form Telehalth",
      "Telehealth",
      "Parental Consent",
      "Student Absence Form",
    ],
    required: true,
  },
  recipientIds: [
    {
      //who to send
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  timestamp: {
    //when
    type: Date,
    default: Date.now,
  },
});

// Creating an index on recipientIds for faster queries
notificationSchema.index({ recipientIds: 1 });

// Creating an index on readBy for faster queries
notificationSchema.index({ readBy: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
