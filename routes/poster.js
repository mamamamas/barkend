const router = require("express").Router();
const Poster = require("../models/poster");
const { cloudinary } = require("../utils/config");
const upload = require("../middlewares/multer");

// default route = /poster
router.get("/", async (req, res) => {
  try {
    const posters = await Poster.find();
    res.status(200).json(posters);
  } catch (err) {
    console.error("Error fetching posters:", err);
    res.status(500).json({ error: "Error fetching posters" });
  }
});

// Create a new poster
router.post("/", upload.single("image"), async (req, res) => {
  const currentUser = req.user;
  const { title, body } = req.body;

  if (currentUser.role !== "staff" && currentUser.role !== "admin") {
    return res.status(403).json({ error: "Not authorized" });
  }

  try {
    let imgUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "poster",
      });
      imgUrl = result.secure_url;
    }

    const newPoster = await Poster.create({
      userId: currentUser._id,
      title,
      body,
      posterUrl: imgUrl,
    });

    return res.status(201).json(newPoster);
  } catch (err) {
    console.error("Error creating poster:", err);
    res.status(500).json({ error: "Error creating poster" });
  }
});

// Delete a poster
router.delete("/:id", async (req, res) => {
  try {
    const posterId = req.params.id;

    const posterToDelete = await Poster.findById(posterId);
    if (!posterToDelete) {
      return res.status(404).json({ message: "Poster not found" });
    }

    const publicId = posterToDelete.posterUrl
      .split("/")
      .slice(-1)[0]
      .split(".")[0];
    const folder = "poster";

    const result = await cloudinary.uploader.destroy(`${folder}/${publicId}`);

    if (result.result === "ok") {
      await Poster.findByIdAndDelete(posterId);
      res.json({ message: "Poster deleted successfully" });
    } else {
      res.status(500).json({ message: "Failed to delete image from Cloudinary" });
    }
  } catch (err) {
    console.error("Error deleting poster:", err);
    res.status(500).json({ error: "Error deleting poster" });
  }
});

module.exports = router;
