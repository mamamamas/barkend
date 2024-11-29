const mongoose = require("mongoose");

const educationInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  educationLevel: {
    type: String,
    enum: ["JHS", "SHS", "College"],
    default: "JHS",
  },
  yearlvl: {
    type: String,
    enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
    default: "7",
  },
  section: {
    type: String,
    enum: ["A", "B", "C", "D"],
    default: "A",
  },
  department: {
    type: String,
    enum: ["CBAA", "CHTM", "COI", "CET", "CCJ", "COE", "CASSW", "CNAH"],
    default: null,
  },
  strand: {
    type: String,
    enum: ["STEM", "HUMMS", "ABM", "TVL-ICT", "TVL-HE"],
    default: null,
  },
  course: {
    type: String,
    enum: [
      "BSBA",
      "BSA",
      "BSREM",
      "BSCA",
      "BSHM",
      "BSTM",
      "ACLM",
      "BSIT",
      "BSCS",
      "BSCpE",
      "BMMA",
      "BSCE",
      "BSEE",
      "BSECE",
      "BSIE",
      "BS Criminology",
      "BECE",
      "BEE",
      "BPE",
      "BSE",
      "BA Psychology",
      "BA Broadcasting",
      "BA Political Science",
      "BS Social Work",
      "BSN",
      "BSND",
    ],
    default: null,
  },
  schoolYear: {
    type: String,
    default: "N/A",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

educationInfoSchema.index({
  educationLevel: 1,
  yearlvl: 1,
  strand: 1,
  course: 1,
  section: 1,
});

module.exports = mongoose.model("EducationInfo", educationInfoSchema);
