const express = require('express');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const MedicalInfo = require("../models/medicalRecords/medicalInfo");
const EducationInfo = require("../models/educationInfo");
const PersonalInfo = require("../models/personalInfo");
const User = require("../models/user");
const mongoose = require('mongoose');
const { jwtSecret } = require("../utils/config");
const router = express.Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { encrypt, decrypt } = require("../utils/encryption");
console.log('JWT Secret:', process.env.JWT_SECRET);



router.post('/auth/google', async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ success: false, error: 'Google token is missing' });
    }

    try {
        // Verify Google ID token
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload['sub'];
        const email = payload['email'];
        const firstName = payload['given_name'];
        const lastName = payload['family_name'];
        const pfp = payload['picture'];

        // Allow only @pcu.edu.ph emails
        if (!email.endsWith('@pcu.edu.ph')) {
            return res.status(400).json({
                success: false,
                error: 'Only @pcu.edu emails are allowed',
            });
        }

        // Check if the user exists
        let user = await User.findOne({ email });

        if (!user) {
            // Create a new user if not exists
            user = new User({
                googleId,
                email,
                pfp,
                role: 'student',
                firstname: firstName,
                lastname: lastName,
            });
            await user.save();

            // Create associated documents (handled in a separate try-catch)
            try {
                await PersonalInfo.create({
                    userId: user._id,
                    firstName: encrypt(firstName),
                    lastName: encrypt(lastName),
                });

                await MedicalInfo.create({ userId: user._id });
                await EducationInfo.create({ userId: user._id });
            } catch (docError) {
                console.error('Error creating associated documents:', docError);
                return res.status(500).json({ success: false, error: 'Error creating associated documents' });
            }
        }

        // Role adjustment for students
        if (user.role !== 'student' && user.role !== 'admin') {
            user.role = 'student';
            await user.save();
        }

        // Generate JWT token
        const accessToken = jwt.sign(
            { sub: user.id, role: user.role, googleId: user.googleId },
            process.env.JWT_SECRET,
            { expiresIn: '30d', audience: 'Saulus', algorithm: 'HS256' }
        );

        // Set cookie and send response
        res.cookie('jwtToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        });

        res.json({
            success: true,
            token: accessToken,
            id: user.id,
            role: user.role,
            firstname: user.firstname,
            username: user.email,
            pfp: user.pfp,
        });
    } catch (error) {
        console.error('Google login error:', error);
        return res.status(400).json({ success: false, error: 'Invalid Google token' });
    }
});

// Update Profile Route
router.post('/updateProfile', async (req, res) => {
    const { id, firstName, lastName, email, profilePic, googleId } = req.body;

    if (!id) {
        return res.status(400).json({ success: false, error: 'User ID is required' });
    }

    try {
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { firstname: firstName, lastname: lastName, email, pfp: profilePic, googleId },
            { new: true, upsert: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.status(200).json({ success: true, user: updatedUser });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ success: false, error: 'Error updating user profile' });
    }
});

module.exports = router;