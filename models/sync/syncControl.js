const mongoose = require("mongoose");

const syncControlSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: "syncFlag",
  },
  flagStatus: {
    type: Boolean,
    default: false,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

// Create SyncControl model to manage sync flag
const syncControl = mongoose.model("SyncControl", syncControlSchema);
module.exports = syncControl;
