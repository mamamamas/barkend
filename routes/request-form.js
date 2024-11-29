const router = require("express").Router();

const moment = require("moment-timezone");

const RequestForm = require("../models/requestForm");
const PersonalInfo = require("../models/personalInfo");
const Notification = require("../models/notification/notification");
const User = require("../models/user");
const { cloudinary } = require("../utils/config");
const upload = require("../middlewares/multer");
const { encrypt, decrypt } = require("../utils/encryption");

// route = request-form

router.get("/", async (req, res) => {
  const currentUser = req.user;
  try {
    const appointments = await RequestForm.find({ userId: currentUser._id })
      .sort({ timestamp: -1 })
      .lean();

    const appointmentsWithUserDetails = await Promise.all(
      appointments.map(async (appointment) => {
        const staffDetails = await PersonalInfo.findOne({
          userId: appointment.handledBy,
        })
          .select("firstName lastName")
          .lean();

        const decryptedStaffDetails = staffDetails
          ? {
            firstName:
              staffDetails.firstName === "N/A"
                ? staffDetails.firstName
                : decrypt(staffDetails.firstName),
            lastName:
              staffDetails.lastName === "N/A"
                ? staffDetails.lastName
                : decrypt(staffDetails.lastName),
          }
          : { firstName: "", lastName: "" };

        return {
          ...appointment, // Spread appointment details
          handledByDetails: decryptedStaffDetails, // Attach userDetails
        };
      })
    );

    res.status(200).json(appointmentsWithUserDetails);
  } catch (err) {
    console.log(err);
    return res.status(400).json({ error: "No Appointment found" });
  }
});

router.get("/teleHealth", async (req, res) => {
  const currentUser = req.user;

  if (currentUser.role === "student") {
    try {
      const appointments = await RequestForm.find({
        userId: currentUser._id,
        formName: "Telehealth",
      })
        .sort({ timestamp: -1 })
        .lean();

      console.log("appointments: ", appointments);

      const appointmentsWithUserDetails = await Promise.all(
        appointments.map(async (appointment) => {
          const userDetails = await PersonalInfo.findOne({
            userId: appointment.handledBy,
          })
            .select("firstName lastName")
            .lean();

          const decryptedStaffDetails = userDetails
            ? {
              firstName:
                userDetails.firstName === "N/A"
                  ? userDetails.firstName
                  : decrypt(userDetails.firstName),
              lastName:
                userDetails.lastName === "N/A"
                  ? userDetails.lastName
                  : decrypt(userDetails.lastName),
            }
            : { firstName: "", lastName: "" };

          return {
            ...appointment, // Spread appointment details
            handledByDetails: decryptedStaffDetails, // Attach userDetails
          };
        })
      );

      res.status(200).json(appointmentsWithUserDetails);
    } catch (err) {
      console.log("error3121: ", err);
      return res.status(400).json({ error: "No Appointment found" });
    }
  } else {
    try {
      const requests = await RequestForm.find({
        handledBy: currentUser._id,
        formName: "Telehealth",
      })
        .sort({ timestamp: -1 })
        .lean();

      const requestsWithUserDetails = await Promise.all(
        requests.map(async (request) => {
          const staffDetails = await PersonalInfo.findOne({
            userId: request.handledBy,
          })
            .select("firstName lastName")
            .lean();

          const userDetails = await PersonalInfo.findOne({
            userId: request.userId,
          })
            .select("firstName lastName")
            .lean();

          const decryptedStaffDetails = staffDetails
            ? {
              firstName:
                staffDetails.firstName === "N/A"
                  ? staffDetails.firstName
                  : decrypt(staffDetails.firstName),
              lastName:
                staffDetails.lastName === "N/A"
                  ? staffDetails.lastName
                  : decrypt(staffDetails.lastName),
            }
            : { firstName: "", lastName: "" };

          const decryptedUserDetails = userDetails
            ? {
              firstName:
                userDetails.firstName === "N/A"
                  ? userDetails.firstName
                  : decrypt(userDetails.firstName),
              lastName:
                userDetails.lastName === "N/A"
                  ? userDetails.lastName
                  : decrypt(userDetails.lastName),
            }
            : { firstName: "", lastName: "" };

          return {
            ...request,
            handledByDetails: decryptedStaffDetails,
            sentBy: decryptedUserDetails,
          };
        })
      );

      res.status(200).json(requestsWithUserDetails);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  }
});

// Admin route to get all requests
router.get("/admin", async (req, res) => {
  const currentUser = req.user;

  if (currentUser.role !== "admin" && currentUser.role !== "staff") {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const requests = await RequestForm.find({}).sort({ timestamp: -1 }).lean();

    const requestsWithUserDetails = await Promise.all(
      requests.map(async (request) => {
        const staffDetails = await PersonalInfo.findOne({
          userId: request.handledBy,
        })
          .select("firstName lastName userId")
          .lean();

        const userDetails = await PersonalInfo.findOne({
          userId: request.userId,
        })
          .select("firstName lastName userId")
          .lean();

        const decryptedStaffDetails = staffDetails
          ? {
            firstName:
              staffDetails.firstName === "N/A"
                ? staffDetails.firstName
                : decrypt(staffDetails.firstName),
            lastName:
              staffDetails.lastName === "N/A"
                ? staffDetails.lastName
                : decrypt(staffDetails.lastName),
          }
          : { firstName: "", lastName: "" };

        const decryptedUserDetails = userDetails
          ? {
            firstName:
              userDetails.firstName === "N/A"
                ? userDetails.firstName
                : decrypt(userDetails.firstName),
            lastName:
              userDetails.lastName === "N/A"
                ? userDetails.lastName
                : decrypt(userDetails.lastName),
          }
          : { firstName: "", lastName: "" };

        console.log("decrypt user: ", decryptedUserDetails);
        // console.log("decrypt staff: ", decryptedStaffDetails);

        return {
          ...request,
          handledByDetails: decryptedStaffDetails,
          sentBy: decryptedUserDetails,
        };
      })
    );

    res.status(200).json(requestsWithUserDetails);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.get("/:id", async (req, res) => {
  const appointmentId = req.params.id;
  console.log("Fetching appointment with ID:", appointmentId);

  try {
    // Find the appointment and populate user details
    const appointment = await RequestForm.findOne({
      _id: appointmentId,
    }).lean();

    if (!appointment) {
      console.log("No appointment found with ID:", appointmentId);
      return res.status(404).json({ error: "Appointment record not found" });
    }

    console.log("Found appointment:", appointment);

    // Find user's personal info
    const userDetails = await PersonalInfo.findOne({
      userId: appointment.userId,
    }).select("firstName lastName").lean();

    console.log("Raw user details:", userDetails);

    // Find staff's personal info if handledBy exists
    const staffDetails = appointment.handledBy ?
      await PersonalInfo.findOne({
        userId: appointment.handledBy,
      }).select("firstName lastName").lean() : null;

    console.log("Raw staff details:", staffDetails);

    // Process user details with proper error handling
    const decryptedUserDetails = {
      firstName: "N/A",
      lastName: "N/A"
    };

    if (userDetails) {
      try {
        // Only decrypt if the values aren't already "N/A"
        decryptedUserDetails.firstName = userDetails.firstName === "N/A" ?
          "N/A" : decrypt(userDetails.firstName);
        decryptedUserDetails.lastName = userDetails.lastName === "N/A" ?
          "N/A" : decrypt(userDetails.lastName);

        console.log("Decrypted user details:", decryptedUserDetails);
      } catch (decryptError) {
        console.error("Error decrypting user details:", decryptError);
        // Keep the N/A values if decryption fails
      }
    }

    // Process staff details with proper error handling
    const decryptedStaffDetails = {
      firstName: "",
      lastName: ""
    };

    if (staffDetails) {
      try {
        // Only decrypt if the values aren't already "N/A"
        decryptedStaffDetails.firstName = staffDetails.firstName === "N/A" ?
          staffDetails.firstName : decrypt(staffDetails.firstName);
        decryptedStaffDetails.lastName = staffDetails.lastName === "N/A" ?
          staffDetails.lastName : decrypt(staffDetails.lastName);

        console.log("Decrypted staff details:", decryptedStaffDetails);
      } catch (decryptError) {
        console.error("Error decrypting staff details:", decryptError);
        // Keep the empty strings if decryption fails
      }
    }

    // Send the response
    const response = {
      appointment,
      userDetails: decryptedUserDetails,
      staffDetails: decryptedStaffDetails,
    };

    console.log("Sending response:", response);
    res.status(200).json(response);

  } catch (err) {
    console.error("Error processing appointment request:", err);
    return res.status(500).json({
      error: "Error processing appointment request",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const requestFormId = req.params.id;
    const currentUser = req.user;

    const requestFormToDelete = await RequestForm.findById(requestFormId);
    if (!requestFormToDelete) {
      return res.status(404).json({ message: "Request form not found" });
    }
    console.log("requestFormToDelete", requestFormToDelete);
    await RequestForm.findByIdAndDelete(requestFormId);

    switch (requestFormToDelete.formName) {
      case "Appointment":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Appointment",
        });
        break;
      case "Medical Leave Form":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Medical Leave Form",
        });
        break;
      case "Medical Record Request":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Medical Record Request",
        });
        break;
      case "Special Leave Form":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Special Leave Form",
        });
        break;
      case "Referral Form Telehalth":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Referral Form Telehalth",
        });
        break;
      case "Telehealth":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Telehealth",
        });
        break;
      case "Medical Leave Form":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Medical Leave Form",
        });
        break;
      case "Parental Consent":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Parental Consent",
        });
      case "Student Absence Form":
        await Notification.deleteOne({
          documentId: requestFormId,
          documentType: "Student Absence Form",
        });
        break;
      default:
        console.error("Unknown document type");
    }

    res.json({
      message: "Request and related notifications cancelled successfully",
    });
  } catch (err) {
    console.log("error:", err);
    res.status(404).json({ error: "error canceling request" });
  }
});

// Appointment Request Form
router.post("/appointment", upload.none(), async (req, res) => {
  const currentUser = req.user;
  const { appointmentDate, reason } = req.body;
  console.log(currentUser)
  try {
    const currentDate = new Date();
    const selectedDate = new Date(appointmentDate);
    if (!reason) {
      return res
        .status(400)
        .json("reason is missing");
    }
    // Check if the selected date is in the past
    if (selectedDate < currentDate) {
      return res
        .status(400)
        .json("Appointment must be 1 day ahead and not in the past");
    }

    const newAppointment = await RequestForm.create({
      userId: currentUser._id,
      formName: "Appointment",
      appointmentDate,
      reason,
    });

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName");

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);

    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made an appointment request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: newAppointment._id,
      documentType: "Appointment",
      recipientIds: recipientIds,
    });

    return res.status(200).json(newAppointment);
  } catch (err) {
    console.log("error: ", err);
  }
});
router.patch("/:id", async (req, res) => {
  const currentUser = req.user;
  const appointmentId = req.params.id;
  const { status, feedback } = req.body;

  if (currentUser.role !== "admin" && currentUser.role !== "staff") {
    return res.status(404).json({ error: "Not authorized" });
  }

  const updateData = { status, handledBy: currentUser._id };

  if (!feedback) {
    return res
      .status(400)
      .json({ error: "Feedback is required when declining" });
  }
  updateData.feedback = feedback; // Store feedback if declining

  if (currentUser.role === "staff") {
    try {
      // Fetch the appointment to get the userId
      const appointment = await RequestForm.findById(appointmentId).select(
        "userId"
      );

      if (!appointment) {
        return res.status(404).json({ error: "No Appointment found" });
      }

      const requester = await User.findById(appointment.userId).select("role");

      if (!requester) {
        return res.status(404).json({ error: "Requester not found" });
      }

      if (requester.role !== "student" && requester.role !== "admin") {
        return res.status(403).json({
          error: "User must be admin to make changes in staff request.",
        });
      }
    } catch (err) {
      console.log("Error fetching appointment or user:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  try {
    const appointment = await RequestForm.findOneAndUpdate(
      { _id: appointmentId },
      updateData,
      { new: true } // Return the updated document
    ).lean();

    if (!appointment) {
      return res.status(404).json({ error: "No Appointment found" });
    }

    console.log("appointmentzxc", appointment);

    const staffDetails = await PersonalInfo.findOne({
      userId: appointment.handledBy,
    }).select("firstName lastName");

    const decryptedStaffDetails = staffDetails
      ? {
        firstName:
          staffDetails.firstName === "N/A"
            ? staffDetails.firstName
            : decrypt(staffDetails.firstName),
        lastName:
          staffDetails.lastName === "N/A"
            ? staffDetails.lastName
            : decrypt(staffDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedStaffDetails.firstName} ${decryptedStaffDetails.lastName} replied to your request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: appointment._id,
      documentType: appointment.formName,
      recipientIds: appointment.userId,
    });

    res.status(200).json({ appointment, decryptedStaffDetails });
  } catch (err) {
    console.log("err:", err);
    return res.status(400).json({ error: "No Appointment found" });
  }
});

// Medical Leave Form
router.post("/medical-leave", upload.single("image"), async (req, res) => {
  const currentUser = req.user;
  const { leave, reason } = req.body;

  //validate time
  const currentDate = new Date();
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);

  if (startDate < currentDate) {
    return res
      .status(400)
      .json({ message: "Start date cannot be in the past." });
  }

  if (startDate >= endDate) {
    return res
      .status(400)
      .json({ message: "Start time must be before end time." });
  }

  try {
    let imgUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "requestforms/medical",
      });
      imgUrl = result.secure_url;
    }

    const newAppointment = await RequestForm.create({
      userId: currentUser._id,
      formName: "Medical Leave Form",
      reason,
      leave: { startDate, endDate },
      medicalCert: imgUrl,
    });

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName");

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);

    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made a medical leave request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: newAppointment._id,
      documentType: "Medical Leave Form",
      recipientIds: recipientIds,
    });

    return res.status(200).json(newAppointment);
  } catch (err) {
    console.log("error: ", err);
  }
});

router.post("/medical-recordR", upload.single("image"), async (req, res) => {
  const currentUser = req.user;
  const { releaseMedRecordto, reason } = req.body;

  try {
    let imgUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "requestforms/medical",
      });
      imgUrl = result.secure_url;
    }

    const newAppointment = await RequestForm.create({
      userId: currentUser._id,
      formName: "Medical Record Request",
      releaseMedRecordto,
      reason,
      supportingDoc: imgUrl || null,
    });

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName");

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);

    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made a medical record release request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: newAppointment._id,
      documentType: "Medical Record Request",
      recipientIds: recipientIds,
    });

    return res.status(200).json(newAppointment);
  } catch (err) {
    console.log("error: ", err);
  }
});

// Parent Consent Form
router.post("/parental-consent", upload.single("image"), async (req, res) => {
  const currentUser = req.user;
  const { appointmentDate, guardianConsent } = req.body;

  const selectedDate = moment.tz(appointmentDate, "Asia/Manila");

  const selectedDateUTC = selectedDate.clone().utc();

  // Check if the appointment is in the past (in Manila timezone)
  const currentDateInPhilippines = moment.tz("Asia/Manila");

  if (selectedDate.isBefore(currentDateInPhilippines)) {
    return res.status(400).json("Appointment cannot be in the past");
  }

  if (currentUser.role !== "student") {
    return res.status(404).json({ error: "Not authorize" });
  }

  try {
    let imgUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "requestforms/parentalConsent",
      });
      imgUrl = result.secure_url;
    }

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName guardian");

    const ParentConsentRequest = await RequestForm.create({
      userId: currentUser._id,
      formName: "Parental Consent",
      guardianName: userDetails.guardian,
      guardianConsent,
      appointmentDate: selectedDateUTC.toISOString(),
      eSignature: imgUrl,
    });

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);

    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made a parental consent request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: ParentConsentRequest._id,
      documentType: "Parental Consent",
      recipientIds: recipientIds,
    });

    return res.status(200).json(ParentConsentRequest);
  } catch (err) {
    console.log("error123: ", err);
  }
});

// Student Absence
router.post("/student-absence", upload.single("image"), async (req, res) => {
  const currentUser = req.user;
  const { dateOfAbsence, reason } = req.body;

  const currentDate = new Date();
  const selectedDate = new Date(dateOfAbsence);

  // Check if the selected date is in the past
  if (selectedDate < currentDate) {
    return res
      .status(400)
      .json("Appointment must be 1 day ahead and not in the past");
  }

  if (currentUser.role !== "student") {
    return res.status(404).json({ error: "Not authorize" });
  }

  try {
    let imgUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "requestforms/studentAbsence",
      });
      imgUrl = result.secure_url;
    }

    const newStudentAbsence = await RequestForm.create({
      userId: currentUser._id,
      formName: "Student Absence Form",
      dateOfAbsence,
      reason,
      supportingDoc: imgUrl || null,
    });

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName");

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);

    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made a student absence request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: newStudentAbsence._id,
      documentType: "Student Absence Form",
      recipientIds: recipientIds,
    });

    return res.status(200).json(newStudentAbsence);
  } catch (err) {
    console.log("error: ", err);
  }
});

// Special Leave Form
router.post("/special-leave", async (req, res) => {
  const currentUser = req.user;
  const { leave, reason, additionalReason } = req.body;

  //validate time
  const currentDate = new Date();
  const startDate = new Date(leave.startDate);
  const endDate = new Date(leave.endDate);

  if (startDate < currentDate) {
    return res
      .status(400)
      .json({ message: "Start date cannot be in the past." });
  }

  if (startDate >= endDate) {
    return res
      .status(400)
      .json({ message: "Start time must be before end time." });
  }

  try {
    const newAppointment = await RequestForm.create({
      userId: currentUser._id,
      formName: "Special Leave Form",
      reason,
      additionalReason,
      leave: { startDate, endDate },
    });

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName");

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);
    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made a special leave request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: newAppointment._id,
      documentType: "Special Leave Form",
      recipientIds: recipientIds,
    });

    return res.status(200).json(newAppointment);
  } catch (err) {
    console.log("error: ", err);
  }
});

router.post("/telehealth", async (req, res) => {
  const currentUser = req.user;
  const { appointmentDate, reason, telehealthType } = req.body;

  try {
    const selectedDate = moment.tz(appointmentDate, "Asia/Manila");

    const selectedDateUTC = selectedDate.clone().utc();

    // Check if the appointment is in the past (in Manila timezone)
    const currentDateInPhilippines = moment.tz("Asia/Manila");

    if (selectedDate.isBefore(currentDateInPhilippines)) {
      return res.status(400).json("Appointment cannot be in the past");
    }

    const newAppointment = await RequestForm.create({
      userId: currentUser._id,
      formName: "Telehealth",
      appointmentDate: selectedDateUTC.toISOString(),
      telehealthType,
      reason,
    });

    const userDetails = await PersonalInfo.findOne({
      userId: currentUser._id,
    }).select("firstName lastName");

    //fetched all userId with role admin/staff
    const recipientUsers = await User.find({
      role: { $in: ["admin", "staff"] },
    }).select("_id");

    // Extract  IDs
    const recipientIds = recipientUsers.map((user) => user._id);

    const decryptedUserDetails = userDetails
      ? {
        firstName:
          userDetails.firstName === "N/A"
            ? userDetails.firstName
            : decrypt(userDetails.firstName),
        lastName:
          userDetails.lastName === "N/A"
            ? userDetails.lastName
            : decrypt(userDetails.lastName),
      }
      : { firstName: "", lastName: "" };

    // Encrypt the title with the decrypted names
    const notificationTitle = `${decryptedUserDetails.firstName} ${decryptedUserDetails.lastName} made a telehealth request!`;
    const encryptedTitle = encrypt(notificationTitle);

    await Notification.create({
      userId: currentUser._id,
      title: encryptedTitle,
      documentId: newAppointment._id,
      documentType: "Telehealth",
      recipientIds: recipientIds,
    });

    return res.status(200).json(newAppointment);
  } catch (err) {
    console.log("error33: ", err);
  }
});

module.exports = router;
