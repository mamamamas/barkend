require("dotenv").config();
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.cloud_name,
  api_key: process.env.api_key,
  api_secret: process.env.api_secret,
});

module.exports = {
  cloudinary,
  port: process.env.PORT,
  mongodUrl: process.env.MONGO_URL,
  atlasUrl: process.env.AtlasURL,
  jwtSecret: process.env.JWT_SECRET,
  clientId: process.env.Client_ID,
  clientSecret: process.env.Client_Secret,
  key: process.env.ENCRYPTION_KEY,
  frontendLink: process.env.frontendLink,
};
