const mongoose = require("mongoose");

const eventAttendeeSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Event",
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    enum: ["confirmed", "not going"],
    default: "confirmed",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

eventAttendeeSchema.index({ eventId: 1 });
eventAttendeeSchema.index({ userId: 1 });
eventAttendeeSchema.index({ eventId: 1, userId: 1 });

module.exports = mongoose.model("EventAttendee", eventAttendeeSchema);
