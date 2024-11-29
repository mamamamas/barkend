const mongoose = require("mongoose");

const changeSchema = new mongoose.Schema({
  archiveId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Archive",
    required: true,
  },
  userId: {
    //who made the changes
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  changedFields: {
    type: Object,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("ArchiveChange", changeSchema);
