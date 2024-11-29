const router = require("express").Router();
const PersonalInfo = require("../models/personalInfo");
const ReadStatus = require("../models/notification/readStatus");
const Notification = require("../models/notification/notification");
const { encrypt, decrypt } = require("../utils/encryption");
// route = /notification
const mongoose = require('mongoose');
router.post('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user._id; // Assuming your auth middleware attaches the user to the request
    console.log(`Usersd ${userId}`);
    // Find all unread notifications for the user
    const unreadNotifications = await Notification.find({
      recipientIds: userId,
      _id: { $nin: await ReadStatus.find({ userId: userId }).distinct('notificationId') }
    });

    // Create read status entries for all unread notifications
    const readStatusEntries = unreadNotifications.map(notification => ({
      notificationId: notification._id,
      userId: userId
    }));

    await ReadStatus.insertMany(readStatusEntries);

    res.status(200).json({ message: 'All notifications marked as read', count: unreadNotifications.length });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
router.get("/", async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user._id);

    const notifications = await Notification.aggregate([
      {
        $match: {
          $or: [
            { recipientIds: { $in: [userId] } } // Use $in to match userId within recipientIds array
          ],
        },
      },
      {
        $lookup: {
          from: "readstatuses", // Collection name in the database (to be joined)
          localField: "_id", // Field from the Notification collection
          foreignField: "notificationId", // Field from the ReadStatus collection
          as: "readStatus", // Name of the new array field
        },
      },
      {
        $addFields: {
          isRead: {
            $in: [userId, "$readStatus.userId"], // Check if the current userId is present in the readStatus.userId array
          },
        },
      },
      {
        $sort: { timestamp: -1 }, // Sort by timestamp, most recent first
      },
    ]);

    // After fetching notifications, decrypt title if encrypted
    const notificationsWithDecryptedTitles = await Promise.all(
      notifications.map(async (notification) => {
        let title;

        // Split the title by ':' and check for 2 parts (IV and encrypted data)
        const parts = notification.title.split(":");
        const isEncrypted = parts.length === 2 && parts[0].length === 32;

        if (isEncrypted) {
          try {
            title = decrypt(notification.title); // Attempt decryption
          } catch (error) {
            console.warn("Failed to decrypt notification title, using as-is:", notification.title);
            title = notification.title; // Use original title if decryption fails
          }
        } else {
          title = notification.title; // Use as-is if not encrypted
        }

        return {
          ...notification,
          title,
        };
      })
    );

    res.json(notificationsWithDecryptedTitles);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Error fetching notifications", details: error.message });
  }
});


router.delete("/delete-all", async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Find all ReadStatus entries for the current user
    const readStatuses = await ReadStatus.find({ userId: currentUserId });

    // Extract the notificationIds from the readStatuses
    const notificationIds = readStatuses.map((status) => status.notificationId);

    await Notification.updateMany(
      { _id: { $in: notificationIds } }, // Only those notifications with read statuses
      { $pull: { recipientIds: currentUserId } } // Remove the user ID from recipientIds
    );

    // Delete notifications where recipientIds is empty
    await Notification.deleteMany({ recipientIds: { $size: 0 } });

    // Optionally, you can also delete the corresponding ReadStatus entries
    await ReadStatus.deleteMany({ userId: currentUserId });

    res.status(200).json({ message: "All read notifications deleted" });
  } catch (error) {
    console.error("Error deleting notifications:", error);
    res.status(500).json({ error: "Failed to delete notifications" });
  }
});
router.post("/:id", async (req, res) => {
  //mark as read
  const notificationId = req.params.id;
  const currentUserId = req.user._id;

  try {
    // Create a read status entry
    let readStatus = await ReadStatus.findOne({
      notificationId,
      userId: currentUserId,
    });

    if (readStatus) {
      return res.status(200).json(readStatus);
    }

    readStatus = await ReadStatus.create({
      notificationId,
      userId: currentUserId,
    });
    return res.status(200).json(readStatus);
  } catch (err) {
    console.log("Error:", err);
    return res.status(500).json({ error: "Failed to fetched notification." });
  }
});

router.post('/mark-as-read/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id; // Assuming you have user information in the request
    console.log(`Usersd ${userId}`);
    // Validate notificationId
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    // Check if the notification exists
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if it's already marked as read
    let readStatus = await ReadStatus.findOne({ notificationId, userId });
    if (readStatus) {
      return res.status(200).json({ message: 'Notification already marked as read' });
    }

    // Create new read status
    readStatus = new ReadStatus({ notificationId, userId });
    await readStatus.save();

    res.status(200).json({ message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// Delete all notifications read by the current user
module.exports = router;
