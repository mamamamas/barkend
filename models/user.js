const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: {
      type: String,
      default: 'N/A'
    },
    pfp: String,
    email: {
      type: String,
      default: 'N/A'
    },
    password: {
      type: String,
      default: '123'
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'student'],
      default: 'student' 
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  });

const User = mongoose.model('User', UserSchema);
module.exports = User;