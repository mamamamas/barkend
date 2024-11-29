// encryption.js
const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const { key } = require("./config"); // Store in environment variables

function encrypt(text) {
  if (typeof text !== "string") {
    return text; // Return the original value if it's not a string
  }
  const iv = crypto.randomBytes(16); // Generate random IV for each encryption
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(encryptedText) {
  if (typeof encryptedText !== "string") {
    return encryptedText; // Return the original value if it's not a string
  }
  const [ivHex, encryptedDataHex] = encryptedText.split(":"); // Split by the colon

  const iv = Buffer.from(ivHex, "hex"); // Convert IV from hex to Buffer
  const encryptedData = Buffer.from(encryptedDataHex, "hex"); // Convert encrypted data from hex to Buffer

  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(key),
    iv // Use the extracted IV
  );
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// const words = "asdasdsad";
// const encryptWords = encrypt(words);
// console.log("encrypted words: ", encryptWords);
// const decryptWords = decrypt(encryptWords);
// console.log("decrypted words: ", decryptWords);

// Export the functions
module.exports = { encrypt, decrypt };
