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
    console.log("token: ", token);
    console.log('Google Client ID:', process.env.GOOGLE_CLIENT_ID);

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

        // Check if the email ends with @pcu.edu.ph before proceeding further
        if (!email.endsWith("@pcu.edu.ph")) {
            console.log("Only @pcu.edu emails are allowed");
            return res.status(400).json({
                success: false,
                error: "Only @pcu.edu emails are allowed"
            });
        }

        // Check if the user exists in the database
        let user = await User.findOne({ email });
        console.log('User Email:', email);
        console.log('Profile Pic:', pfp);

        if (!user) {
            try {
                // Create a new user if they don't exist
                user = new User({
                    googleId,
                    email,
                    pfp,
                    role: 'student',
                    firstname: firstName,
                    lastname: lastName,
                });
                await user.save();

                const encryptedUserFirstName = encrypt(firstName);
                const encryptedUserLastName = encrypt(lastName);

                // Create associated documents with default values
                await PersonalInfo.create({
                    userId: user._id,
                    firstName: encryptedUserFirstName,
                    lastName: encryptedUserLastName,
                });

                await MedicalInfo.create({
                    userId: user._id,
                });

                await EducationInfo.create({
                    userId: user._id,
                });
                const personalInfo = await PersonalInfo.findOne({ userId: user._id });
                if (personalInfo) {
                    const decryptedFirstName = decrypt(personalInfo.firstName);
                    const decryptedLastName = decrypt(personalInfo.lastName);
                    console.log('Decrypted names:', decryptedFirstName, decryptedLastName);
                } else {
                    console.log('No personal info found for user:', user._id);
                }

                console.log('New user and associated documents created successfully');
            } catch (error) {
                console.error('Error creating new user and associated documents:', error);
                return res.status(500).json({ success: false, error: 'Error creating user account' });
            }
        } else if (user.role === 'admin') {
            return res.status(400).json({
                success: false,
                error: 'Student can only log in via Google',
            });
        }

        if (user.role !== 'student' && user.role !== 'admin') {
            user.role = 'student';
            await user.save();
        }

        // Generate JWT token for the app
        const accessToken = jwt.sign(
            { sub: user.id, role: user.role, googleId: user.googleId },
            process.env.JWT_SECRET,
            { expiresIn: '30d', audience: 'Saulus', algorithm: 'HS256' }
        );
        res.cookie('jwtToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days expiration
        });
        // Send response with the JWT token and user data
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
        res.status(400).json({ success: false, error: 'Invalid Google token' });
    }
});


// Route to update user profile with Google data
router.post('/updateProfile', async (req, res) => {
    const userId = req.params.id
    const { firstName, lastName, email, profilePic, googleId } = req.body;

    console.log(profilePic);
    try {
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { firstName, lastName, email, profilePic, googleId },
            { new: true, upsert: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json(updatedUser);
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ message: 'Error updating user profile' });
    }
});


module.exports = router;
