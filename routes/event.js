const router = require("express").Router();
const Event = require("../models/event/event");
const EventAttendee = require("../models/event/eventAttendee");
const PersonalInfo = require("../models/personalInfo");
const Notification = require("../models/notification/notification");
const { encrypt, decrypt } = require("../utils/encryption");
const User = require("../models/user");
// default = ('/events')


router.get("/", async (req, res) => {
  const currentUser = req.user;
  console.log("Current User:", req.user);

  try {
    // Get the start of the current day (midnight)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0); // Set time to midnight

    // Remove events that ended before today
    const deleteResult = await Event.deleteMany({ 'when.endTime': { $lt: todayStart } });
    console.log(`${deleteResult.deletedCount} past events removed.`);

    const events = await Event.aggregate([
      {
        $lookup: {
          from: "eventattendees",
          localField: "_id",
          foreignField: "eventId",
          as: "attendees",
        },
      },
      {
        $project: {
          title: 1,
          who: 1,
          when: 1,
          where: 1,
          about: 1,
          limit: 1,
          timestamp: 1,
          attendeeCount: { $size: "$attendees" },
          isUserAttending: {
            $in: [currentUser._id, "$attendees.userId"],
          },
          attendees: 1,
        },
      },
      {
        $sort: { "when.startTime": -1 },
      },
    ]);

    const decryptUserDetails = async (attendee) => {
      const userDetails = await PersonalInfo.findOne({
        userId: attendee.userId,
      })
        .select("firstName lastName")
        .lean();

      if (!userDetails) return { ...attendee, firstName: "", lastName: "" };

      return {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
        status: attendee.status,
      };
    };

    const eventsWithDecryptedAttendees = await Promise.all(
      events.map(async (event) => {
        const decryptedAttendees = await Promise.all(
          (event.attendees || []).map(decryptUserDetails)
        );

        return { ...event, attendees: decryptedAttendees };
      })
    );

    res.status(200).json(eventsWithDecryptedAttendees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching events", error: err });
  }
});


router.post("/", async (req, res) => {
  const currentUser = req.user;
  const { title, who, when, limit, where, about } = req.body;

  const startTime = new Date(when.startTime);
  const endTime = new Date(when.endTime);
  if (startTime >= endTime) {
    return res
      .status(400)
      .json({ message: "Start time must be before end time." });
  }

  try {
    // Fetch the current user's full name
    const adminUser = await User.findOne({
      $or: [
        { sub: currentUser._id },
        { _id: currentUser._id }
      ]
    });

    if (!adminUser) {
      console.error(`Admin user not found for sub: ${currentUser._id}`);
      return res.status(404).json({ message: "Admin user not found" });
    }

    const adminName = adminUser.firstName || adminUser.name || currentUser.firstName || 'Unknown Admin';

    const newEvent = await Event.create({
      userId: currentUser._id,
      adminName: adminName,
      title,
      who,
      when: { startTime, endTime },
      limit,
      where,
      about,
    });

    // Fetch all users (assuming you want to notify all users)
    const allUsers = await User.find().select('_id');

    if (!allUsers || allUsers.length === 0) {
      console.warn("No users found to notify");
    }

    // Extract user IDs
    const recipientIds = allUsers.map(user => user._id);

    // Create notification title
    const notificationTitle = `New Event: ${title} (Added by ${adminName})`;
    const encryptedTitle = encrypt(notificationTitle);

    // Create notification
    await Notification.create({
      userId: currentUser._id,
      adminName: adminName,
      title: encryptedTitle,
      documentId: newEvent._id,
      documentType: "event",
      recipientIds: recipientIds,
    });

    console.log(`Event created by ${adminName} and notification sent`);
    return res.status(201).json(newEvent);
  } catch (err) {
    console.error("Error creating event or sending notification:", err);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ message: "Invalid input data", errors: err.errors });
    }
    return res.status(500).json({ message: "Error creating event or sending notification" });
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

    if (updatedFields.when) {
      if (updatedFields.when.startTime) {
        updatedFields.when.startTime = new Date(updatedFields.when.startTime);
      }
      if (updatedFields.when.endTime) {
        updatedFields.when.endTime = new Date(updatedFields.when.endTime);
      }

      // Validate start and end time
      const startTime = updatedFields.when.startTime;
      const endTime = updatedFields.when.endTime;
      if (startTime >= endTime) {
        return res
          .status(400)
          .json({ message: "Start time must be before end time." });
      }
    }

    const updateEvent = await Event.findByIdAndUpdate(Id, updatedFields);

    return res.status(200).json(updateEvent);
  } catch (err) {
    console.log("error:", err);
    res.status(404).json({ error: "error updating event" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const eventId = req.params.id;
    const currentUser = req.user;

    if (currentUser.role !== "admin") {
      return res.status(404).json({ error: "Not authorize" });
    }

    const eventToDelete = await Event.findById(eventId);
    if (!eventToDelete) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Event.findByIdAndDelete(eventId);
    res.json({ message: "Event deleted successfully" });
  } catch (err) {
    console.log("error:", err);
    res.status(404).json({ error: "error deleting event" });
  }
});

//for attending event
router.post("/:id/attend", async (req, res) => {
  const eventId = req.params.id;
  const currentUser = req.user;
  console.log("Current User:", currentUser);
  console.log("User Sub ID:", currentUser._id);

  try {
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if the user is already attending
    console.log(`Checking attendance for Event ID: ${eventId}, User ID: ${currentUser._id}`);
    const existingAttendance = await EventAttendee.findOne({
      eventId,
      userId: currentUser._id,
    });

    console.log("Existing Attendance:", existingAttendance);

    if (existingAttendance) {
      console.log("Deleting attendance:", existingAttendance);
      await EventAttendee.deleteOne({ eventId, userId: currentUser._id });
      return res
        .status(200)
        .json({ message: "Successfully marked as uninterested" });
    } else {
      // Check if the event has reached its limit
      const attendeeCount = await EventAttendee.countDocuments({ eventId });
      console.log(`Current Attendee Count for Event ID ${eventId}:`, attendeeCount);

      if (event.limit !== 0 && attendeeCount >= event.limit) {
        return res.status(400).json({ message: "Event has reached its limit" });
      }
    }

    // Add the user as an attendee
    const newAttendee = new EventAttendee({
      eventId,
      userId: currentUser._id, // Ensure you're using the correct ID property
    });

    await newAttendee.save();

    res.status(200).json({ message: "Successfully marked as attending" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "Failed to Attend Event." });
  }
});



module.exports = router;
