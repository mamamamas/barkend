const router = require("express").Router();

const Post = require("../models/post");
const PersonalInfo = require("../models/personalInfo");
const Notification = require("../models/notification/notification");
const { encrypt, decrypt } = require("../utils/encryption");
//default route = /post

router.get("/", async (req, res) => {
  try {
    const posts = await Post.find().sort({ timestamp: -1 });
    res.status(200).json(posts);
  } catch (err) {
    return res.status(400).json({ error: "No Post found" });
  }
});


router.post("/", async (req, res) => {
  const currentUser = req.user;
  const { title, body } = req.body;

  if (currentUser.role !== "admin") {
    return res.status(404).json({ error: "Not authorized" });
  }

  try {
    const newPost = await Post.create({
      title,
      body,
      userId: currentUser._id,
    });

    return res.status(200).json(newPost);
  } catch (err) {
    console.log("error: ", err);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const Id = req.params.id;
    const currentUser = req.user;
    const updatedFields = req.body;

    if (currentUser.role !== "admin") {
      return res.status(404).json({ error: "Not authorize" });
    }

    const updatePost = await Post.findByIdAndUpdate(Id, updatedFields);

    return res.status(200).json(updatePost);
  } catch (err) {
    console.log("error:", err);
    res.status(404).json({ error: "error updating post" });
  }
});

router.post("/delete", async (req, res) => {
  try {
    const postId = req.body.id;
    const currentUser = req.user;
    console.log(postId);
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(404).json({ error: "Not authorized" });
    }
    const postToDelete = await Post.findById(postId);
    if (!postToDelete) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Post.findByIdAndDelete(postId);
    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    console.log("error:", err);
    res.status(404).json({ error: "error deleting post" });
  }
});
module.exports = router;
