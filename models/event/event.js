const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  who: {
    type: String,
    required: true,
  },
  when: {
    startTime: {
      type: Date, // Change to String
      required: true,
    },
    endTime: {
      type: Date, // Change to String
      required: true,
    },
  },
  where: {
    type: String,
    required: true,
  },
  about: {
    type: String,
    required: true,
  },
  limit: {
    type: Number,
    default: null,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Event", eventSchema);
