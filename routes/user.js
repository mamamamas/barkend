const router = require("express").Router();
const jwt = require("jsonwebtoken");
const tokenBlacklist = new Set();
const passport = require("../utils/passport");
const { hashPassword, comparePassword } = require("../utils/bcrypted");
const { frontendLink, jwtSecret } = require("../utils/config");
const { encrypt, decrypt } = require("../utils/encryption");
const bcrypt = require('bcrypt');
const User = require("../models/user");
const PersonalInfo = require("../models/personalInfo");
const EducationInfo = require("../models/educationInfo");
const MedicalInfo = require("../models/medicalRecords/medicalInfo");
const Immunization = require("../models/medicalRecords/immunization");
const Assessment = require("../models/medicalRecords/assessment");
const redis = require('redis');
const redisClient = redis.createClient();
const auth = require("../middlewares/jwtAuth");
const { cloudinary } = require("../utils/config");
const upload = require("../middlewares/multer");

//default rotue = '/'

router.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
  })
);

router.get("/auth/google/callback", (req, res, next) => {
  passport.authenticate(
    "google",
    {
      session: false,
      failureRedirect:
        process.env.NODE_ENV === "production"
          ? "https://saulus1.onrender.com"
          : "http://localhost:5173",
    },
    (err, user) => {
      if (err || !user) {
        return res.redirect(
          process.env.NODE_ENV === "production"
            ? "https://saulus1.onrender.com"
            : "http://localhost:5173"
        );
      }

      const token = jwt.sign({ id: user.id }, jwtSecret);
      res.cookie("jwtToken", token, {
        httpOnly: true,
        secure: true,
        sameSite: "None",
      });
      console.log("google token  taken: ", token);
      res.redirect(
        process.env.NODE_ENV === "production"
          ? "https://saulus1.onrender.com"
          : "http://localhost:5173"
      );
    }
  )(req, res, next);
});

router.get("/logout", async (req, res) => {
  const token = req.headers.authorization.split(' ')[1];

  try {
    jwt.verify(token, jwtSecret);
  } catch (err) {
    return res.status(400).json({ message: 'The token is invalid' });
  }

  if (tokenBlacklist.has(token)) {
    return res.status(200).json({ message: 'The token is already in the blacklist' });
  }

  tokenBlacklist.add(token);
  res.status(200).json({ message: 'Logged out successfully' });
});

// router.get("/", auth, async (req, res) => {
//   try {
//     const user = req.user;
//     console.log("being fetched in frontend: ", user);
//     res.status(200).json(user);
//   } catch (err) {
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

router.post("/register/admin", async (req, res) => {
  const { username, password, email } = req.body;

  try {
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
      role: "admin",
    });

    await PersonalInfo.create({
      userId: newUser._id,
    });

    await MedicalInfo.create({
      userId: newUser._id,
    });

    await EducationInfo.create({
      userId: newUser._id,
      educationLevel: null,
      yearlvl: null,
      section: null,
      department: null,
      strand: null,
      course: null,
    });

    const token = jwt.sign({ id: newUser.id }, jwtSecret);
    res.cookie("jwtToken", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
    });
    return res.status(200).json({ message: "Register Successful" });
  } catch (err) {
    res.status(404).json({ error: "error registering" });
  }
});




router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    if (user.role === "student") {
      return res.status(400).json({ error: "Students can only login via Google" });
    }

    // Compare password
    const match = await comparePassword(password, user.password);
    if (match) {
      const payload = {
        sub: user._id.toString(),
        aud: 'Saulus',
        role: user.role,
        firstname: user.firstname,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 30), // Expiry set for 30 days
      };

      // Sign the JWT token
      const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { algorithm: 'HS256' });

      // Set the token as an HTTP-only cookie
      res.cookie('jwtToken', accessToken, {
        httpOnly: true,  // Cookie is not accessible via JavaScript
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (over HTTPS)
        sameSite: 'strict',  // Helps prevent CSRF attacks
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days expiration
      });

      return res.status(200).json({
        message: 'Login successful',
        role: user.role,
        firstname: user.firstname,
        username: user.username,
        accessToken,
        id: user._id,
      });
    } else {
      return res.status(400).json({ error: "Password does not match" });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: "An error occurred during login" });
  }
});


router.get("/profile/:id", auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUser = req.user;
    const currentUserId = req.user._id;
    console.log(currentUser)
    // Authorization check
    if (
      currentUser.role !== "admin" &&
      currentUser.role !== "staff" &&
      !currentUserId.equals(userId)
    ) {
      return res.status(404).json({ error: "Not authorized" });
    }

    // Get current user's education info for staff authorization
    const currentUserEducation = await EducationInfo.findOne({
      userId: currentUserId,
    }).select("educationLevel");

    // Retrieve user's data
    const personal = await PersonalInfo.findOne({ userId });
    const medical = await MedicalInfo.findOne({ userId });
    const education = await EducationInfo.findOne({ userId });
    const user = await User.findById(userId, "pfp");

    // Assessments and immunization data
    const assessment = await Assessment.find({ medicalInfoId: medical?._id });
    const immunization = await Immunization.find({
      medicalInfoId: medical?._id,
    });

    const decryptIfValid = (value) => {
      if (value && value !== "N/A" && value.includes(":")) {
        return decrypt(value);
      }
      return value; // Return the original value if it's invalid for decryption
    };

    // Decrypt personal info if available
    if (personal) {
      personal.firstName = decryptIfValid(personal.firstName);
      personal.lastName = decryptIfValid(personal.lastName);
      personal.sex = decryptIfValid(personal.sex); // Decrypt 'sex' enum
      personal.civilStatus = decryptIfValid(personal.civilStatus); // Decrypt 'civilStatus' enum
      personal.address = decryptIfValid(personal.address);
      personal.religion = decryptIfValid(personal.religion);
      personal.telNo = decryptIfValid(personal.telNo);
      personal.guardian = decryptIfValid(personal.guardian);
      personal.guardianAddress = decryptIfValid(personal.guardianAddress);
      personal.guardianTelNo = decryptIfValid(personal.guardianTelNo);

      if (personal.dateOfBirth) {
        personal.dateOfBirth = new Date(personal.dateOfBirth); // This may be redundant if it's already a Date
      }
    }

    if (medical) {
      const medicalFields = [
        "respiratory",
        "digestive",
        "nervous",
        "excretory",
        "endocrine",
        "circulatory",
        "skeletal",
        "muscular",
        "reproductive",
        "lymphatic",
        "psychological",
        "specificPsychological",
        "allergy",
        "specificAllergy",
        "eyes",
        "ear",
        "nose",
        "throat",
        "tonsils",
        "teeth",
        "tongue",
        "neck",
        "thyroids",
        "cervicalGlands",
        "chest",
        "contour",
        "heart",
        "rate",
        "rhythm",
        "bp",
        "height",
        "weight",
        "bmi",
        "lungs",
        "abdomen",
        "ABcontour",
        "liver",
        "spleen",
        "kidneys",
        "extremities",
        "upperExtremities",
        "lowerExtremities",
        "bloodChemistry",
        "cbc",
        "urinalysis",
        "fecalysis",
        "chestXray",
        "others",
      ];

      medicalFields.forEach((field) => {
        if (
          medical[field] &&
          medical[field] !== "N/A" &&
          medical[field].includes(":")
        ) {
          medical[field] = decrypt(medical[field]);
        }
      });
    }

    if (immunization) {
      immunization.forEach((item) => {
        item.vaccine = decryptIfValid(item.vaccine);
        item.remarks = decryptIfValid(item.remarks);
      });
    }

    if (assessment) {
      assessment.forEach((item) => {
        item.complaints = decryptIfValid(item.complaints);
        item.actions = decryptIfValid(item.actions);
        if (item.followUps) {
          item.followUps.followUpComplaints = decryptIfValid(
            item.followUps.followUpComplaints
          );
          item.followUps.followUpActions = decryptIfValid(
            item.followUps.followUpActions
          );
        }
      });
    }

    // Return the data, ensuring consistency with PATCH
    return res.status(200).json({
      personal,
      medical,
      education,
      assessment,
      immunization,
      pfp: user?.pfp,
      staffAuth: currentUserEducation,
    });
  } catch (err) {
    res.status(404).json({ error: "Error fetching user" });
  }
});

router.patch("/profile/:id", auth, async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUser = req.user;
    const currentUserId = req.user._id;
    const { personal, education, medical } = req.body;

    // Check for authorization
    if (
      currentUser.role !== "admin" &&
      currentUser.role !== "staff" &&
      currentUserId !== userId
    ) {
      return res.status(403).json({ error: "Not authorized" });
    }
    // Update Personal Info
    if (personal) {
      if (personal.firstName !== null)
        personal.firstName = encrypt(personal.firstName);
      if (personal.lastName !== null)
        personal.lastName = encrypt(personal.lastName);
      if (personal.sex !== null) personal.sex = encrypt(personal.sex); // Encrypt 'sex' enum
      if (personal.civilStatus !== null)
        personal.civilStatus = encrypt(personal.civilStatus); // Encrypt 'civilStatus' enum
      if (personal.address !== null)
        personal.address = encrypt(personal.address);
      if (personal.religion !== null)
        personal.religion = encrypt(personal.religion);
      if (personal.telNo !== null) personal.telNo = encrypt(personal.telNo);
      if (personal.guardian !== null)
        personal.guardian = encrypt(personal.guardian);
      if (personal.guardianAddress !== null)
        personal.guardianAddress = encrypt(personal.guardianAddress);
      if (personal.guardianTelNo !== null)
        personal.guardianTelNo = encrypt(personal.guardianTelNo);

      if (personal.dateOfBirth !== null) {
        // You can keep it as a date string, or convert it to a Date object
        personal.dateOfBirth = new Date(personal.dateOfBirth);
      }

      await PersonalInfo.findOneAndUpdate({ userId: userId }, personal, {
        new: true,
        upsert: true,
      });
    }

    // Update Education Info
    if (education) {
      await EducationInfo.findOneAndUpdate({ userId: userId }, education, {
        new: true,
        upsert: true,
      });
    }

    // Update Medical Info
    if (medical) {
      const medicalToUpdate = {}; // Initialize as an empty object

      // Encrypt only string fields in the medical object
      for (const key in medical) {
        if (medical[key] !== null) {
          // Check if the field should be encrypted
          if (key === "timestamp" || key === "_id" || key === "userId") {
            // Handle timestamp, _id, and userId directly
            medicalToUpdate[key] = medical[key]; // Keep them as they are
          } else if (typeof medical[key] === "boolean") {
            // Handle booleans directly
            medicalToUpdate[key] = medical[key];
          } else if (
            typeof medical[key] === "object" &&
            medical[key] instanceof Date
          ) {
            // Handle dates directly
            medicalToUpdate[key] = new Date(medical[key]);
          } else if (typeof medical[key] === "string") {
            // Encrypt string fields
            medicalToUpdate[key] = encrypt(medical[key]);
          } else {
            // Handle other types as needed
            medicalToUpdate[key] = medical[key];
          }
        }
      }

      await MedicalInfo.findOneAndUpdate(
        { userId: userId },
        { $set: medicalToUpdate },
        { new: true, upsert: true }
      );
    }

    // Optionally, return updated data (or omit if not needed)
    const updatedPersonal = personal
      ? await PersonalInfo.findOne({ userId: userId })
      : null;
    const updatedEducation = education
      ? await EducationInfo.findOne({ userId: userId })
      : null;
    const updatedMedical = medical
      ? await MedicalInfo.findOne({ userId: userId })
      : null;

    return res.status(200).json({
      personal: updatedPersonal,
      education: updatedEducation,
      medical: updatedMedical,
    });
  } catch (err) {
    res.status(404).json({ error: "error updating user" });
  }
});

router.post(
  "/profile/:id/photo",
  auth,
  upload.single("image"),
  async (req, res) => {
    const Id = req.params.id;
    const currentUser = req.user;

    try {
      let imgUrl = "";
      if (req.file) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: "requestforms/medical",
        });
        imgUrl = result.secure_url;
      }

      const newProfile = await User.findByIdAndUpdate(Id, { pfp: imgUrl });
      return res.status(200).json(newProfile);
    } catch (err) { }
  }
);

module.exports = router;
