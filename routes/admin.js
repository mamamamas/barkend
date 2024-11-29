const router = require("express").Router();
const PersonalInfo = require("../models/personalInfo");
const EducationInfo = require("../models/educationInfo");
const MedicalInfo = require("../models/medicalRecords/medicalInfo");
const User = require("../models/user");
const { encrypt, decrypt } = require("../utils/encryption");
const { hashPassword, comparePassword } = require("../utils/bcrypted");
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../utils/config");

//default route = /admin

router.get("/", async (req, res) => {
  const { educationLevel } = req.query;
  console.log("query: ", educationLevel);

  try {
    const accounts = await EducationInfo.find({ educationLevel }).populate(
      "userId"
    );

    const combinedData = await Promise.all(
      accounts.map(async (account) => {
        if (!account.userId) {
          console.warn(`Missing userId for account: ${account._id}`);
          return null; // Skip if userId is missing
        }

        const userId = account.userId._id || account.userId; // Use _id if populated
        const user = await User.findById(userId);

        // Check if the user's role is not 'student'
        if (user && user.role !== "student") {
          const personal = await PersonalInfo.findOne(
            { userId },
            "userId firstName lastName"
          );

          const firstName = personal
            ? personal.firstName === "N/A"
              ? "N/A"
              : decrypt(personal.firstName)
            : "N/A";

          const lastName = personal
            ? personal.lastName === "N/A"
              ? "N/A"
              : decrypt(personal.lastName)
            : "N/A";

          return { userId, firstName, lastName };
        }
        return null; // Return null if user is a student or not found
      })
    );

    // Filter out null values to return only valid user data
    const filteredData = combinedData.filter((data) => data !== null);

    res.json(filteredData);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Error fetching users" }); // Changed status to 500 for server error
  }
});

router.post("/register", async (req, res) => {
  const { username, password, email, education } = req.body;
  const currentUser = req.user;

  try {
    if (currentUser.role !== "admin") {
      return res.status(404).json({ error: "Not authorized" });
    }

    const exist = await User.findOne({ username });
    if (exist) {
      return res.status(400).json({ error: "User already exist" });
    }

    const existE = await User.findOne({ email });
    if (existE) {
      return res.status(400).json({ error: "Email already exist" });
    }

    const hashedPassword = await hashPassword(password);
    const newUser = await User.create({
      username: username,
      password: hashedPassword,
      email,
      role: "staff",
    });

    await PersonalInfo.create({
      userId: newUser._id,
    });

    await MedicalInfo.create({
      userId: newUser._id,
    });

    await EducationInfo.create({
      userId: newUser._id,
      educationLevel: education.educationLevel,
      yearlvl: education.yearlvl || null,
      section: education.section || null,
      department: education.department || null,
      strand: education.strand || null,
      course: education.course || null,
    });
    return res.status(200).json({ message: "Register Successful" });
  } catch (err) {
    console.log("error: ", err);
    res.status(404).json({ error: "error registering" });
  }
});

router.patch("/account/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUser = req.user;
    const { email, password, username, education } = req.body;

    if (currentUser.role !== "admin") {
      return res.status(404).json({ error: "Not authorize" });
    }
    const existingUser = await User.findOne({
      $or: [{ email: email }, { username: username }],
      _id: { $ne: userId }, // Exclude the current user being updated
    });

    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ error: "Email already exists" });
      } else if (existingUser.username === username) {
        return res.status(400).json({ error: "Username already exists" });
      }
    }

    // Update User Info
    const hashedPassword = await hashPassword(password);
    const updateUser = await User.findOneAndUpdate(
      { _id: userId },
      { email, password: hashedPassword, username },
      {
        new: true,
        upsert: true,
      }
    );

    // Update Education Info
    let updatedEducation = null;
    if (education) {
      updatedEducation = await EducationInfo.findOneAndUpdate(
        { userId: userId },
        education,
        {
          new: true,
          upsert: true,
        }
      );
    }

    return res.status(200).json({
      user: updateUser,
      education: updatedEducation,
    });
  } catch (err) {
    console.log("err: ", err);
    res.status(404).json({ error: "error updating user" });
  }
});

router.get("/account/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUser = req.user;

    if (currentUser.role !== "admin") {
      return res.status(404).json({ error: "Not authorized" });
    }

    const user = await User.findById(userId);
    const education = await EducationInfo.findOne({ userId });

    // Return the data, ensuring consistency with PATCH
    return res.status(200).json({
      user,
      education,
    });
  } catch (err) {
    res.status(404).json({ error: "Error fetching user" });
  }
});

router.post("/password", async (req, res) => {
  const { adminPassword } = req.body;
  const currentUserId = req.user._id;

  try {
    const user = await User.findById({ _id: currentUserId });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    if (user.role === "student") {
      return res.status(400).json({ error: "Not Authorized" });
    }

    const match = await comparePassword(adminPassword, user.password);
    if (match) {
      return res.status(200).json({ message: "Authentication Successful" });
    } else {
      return res.status(400).json({ error: "Password do not match" });
    }
  } catch (err) {
    console.log("error authenticating: ", err);
    res.status(404).json({ error: "error logging in" });
  }
});

module.exports = router;
