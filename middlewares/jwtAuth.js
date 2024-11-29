const jwt = require("jsonwebtoken");
const User = require("../models/user");
const PersonalInfo = require("../models/personalInfo");
const { jwtSecret } = require("../utils/config");
const { decrypt } = require("../utils/encryption");

const auth = async (req, res, next) => {
  let token = req.cookies.jwtToken;

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ error: "No token found" });
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET, { audience: 'Saulus' });
    console.log("Decoded Token Data: ", data);

    const user = await User.findById(data.sub).select(
      "-password -timestamp"
    );
    console.log("Searching for user with ID: ", data.sub);

    if (!user) {
      return res.status(404).json({ error: "No user found" });
    }

    // Verify that the role in the token matches the user's role in the database
    if (data.role !== user.role) {
      console.log("Token role:", data.role, "User role:", user.role);
      return res.status(403).json({ error: "Invalid user role" });
    }

    const userDetails = await PersonalInfo.findOne({ userId: user._id }).select(
      "firstName lastName"
    );

    const decryptedUserDetails = userDetails
      ? {
        firstName: userDetails.firstName === "N/A" ? userDetails.firstName : decrypt(userDetails.firstName),
        lastName: userDetails.lastName === "N/A" ? userDetails.lastName : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    req.user = { ...user.toObject(), decryptedUserDetails };
    next();
  } catch (err) {
    console.log("Auth error: ", err);
    return res.status(401).json({ error: "Token is not valid" });
  }
};

module.exports = auth;