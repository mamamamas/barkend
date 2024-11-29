const mongoose = require('mongoose');

const BlacklistedTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '30d' // Automatically remove the token after 30 days
    }
});

module.exports = mongoose.model('BlacklistedToken', BlacklistedTokenSchema);