const mongoose = require("mongoose");

const medicalInfoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  //(II)
  respiratory: {
    type: String,
    default: "N/A",
  },
  digestive: {
    type: String,
    default: "N/A",
  },
  nervous: {
    type: String,
    default: "N/A",
  },
  excretory: {
    type: String,
    default: "N/A",
  },
  endocrine: {
    type: String,
    default: "N/A",
  },
  circulatory: {
    type: String,
    default: "N/A",
  },
  skeletal: {
    type: String,
    default: "N/A",
  },
  muscular: {
    type: String,
    default: "N/A",
  },
  reproductive: {
    type: String,
    default: "N/A",
  },
  lymphatic: {
    type: String,
    default: "N/A",
  },
  psychological: {
    type: String,
    default: "N/A",
  },
  specificPsychological: {
    type: String,
    default: "N/A",
  },
  //(III)
  smoking: {
    type: Boolean,
    default: "false",
  },
  drinking: {
    type: Boolean,
    default: "false",
  },
  allergy: {
    type: String,
    default: "N/A",
  },
  specificAllergy: {
    type: String,
    default: "N/A",
  },
  //IV
  eyes: {
    type: String,
    default: "N/A",
  },
  ear: {
    type: String,
    default: "N/A",
  },
  nose: {
    type: String,
    default: "N/A",
  },
  throat: {
    type: String,
    default: "N/A",
  },
  tonsils: {
    type: String,
    default: "N/A",
  },
  teeth: {
    type: String,
    default: "N/A",
  },
  tongue: {
    type: String,
    default: "N/A",
  },
  neck: {
    type: String,
    default: "N/A",
  },
  thyroids: {
    type: String,
    default: "N/A",
  },
  cervicalGlands: {
    type: String,
    default: "N/A",
  },
  //V
  chest: {
    type: String,
    default: "N/A",
  },
  contour: {
    type: String,
    default: "N/A",
  },
  heart: {
    type: String,
    default: "N/A",
  },
  rate: {
    type: String,
    default: "N/A",
  },
  rhythm: {
    type: String,
    default: "N/A",
  },
  bp: {
    type: String,
    default: "N/A",
  },
  height: {
    type: String,
    default: "N/A",
  },
  weight: {
    type: String,
    default: "N/A",
  },
  bmi: {
    type: String,
    default: "N/A",
  },
  lungs: {
    type: String,
    default: "N/A",
  },
  //VI
  abdomen: {
    type: String,
    default: "N/A",
  },
  ABcontour: {
    type: String,
    default: "N/A",
  },
  liver: {
    type: String,
    default: "N/A",
  },
  spleen: {
    type: String,
    default: "N/A",
  },
  kidneys: {
    type: String,
    default: "N/A",
  },
  //VII
  extremities: {
    type: String,
    default: "N/A",
  },
  upperExtremities: {
    type: String,
    default: "N/A",
  },
  lowerExtremities: {
    type: String,
    default: "N/A",
  },
  //VIII.
  bloodChemistry: {
    type: String,
    default: "N/A",
  },
  cbc: {
    type: String,
    default: "N/A",
  },
  urinalysis: {
    type: String,
    default: "N/A",
  },
  fecalysis: {
    type: String,
    default: "N/A",
  },
  chestXray: {
    type: String,
    default: "N/A",
  },
  others: {
    type: String,
    default: "N/A",
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("MedicalInfo", medicalInfoSchema);
