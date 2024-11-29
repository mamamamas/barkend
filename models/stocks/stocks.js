const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema({
  stockItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StockItem",
    required: true,
  },
  initialQuantity: {
    type: Number,
  },
  currentQuantity: {
    type: Number,
  },
  expirationDate: {
    type: Date,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Stock", stockSchema);
