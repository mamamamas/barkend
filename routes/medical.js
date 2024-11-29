const router = require("express").Router();
const MedicalInfo = require("../models/medicalRecords/medicalInfo");
const EducationInfo = require("../models/educationInfo");
const PersonalInfo = require("../models/personalInfo");
const User = require("../models/user");
const Assessment = require("../models/medicalRecords/assessment");
const Immunization = require("../models/medicalRecords/immunization");
const Archive = require("../models/archive/archive");
const ArchiveChange = require("../models/archive/archiveChanges");
const { encrypt, decrypt } = require("../utils/encryption");

//default = '/medical'

router.get("/", async (req, res) => {
  try {
    const { educationLevel, yearlvl, strand, course, section } = req.query;

    // Query to filter students based on the selected fields
    const students = await EducationInfo.find({
      educationLevel,
      yearlvl,
      strand: strand || { $exists: true },
      course: course || { $exists: true },
      section,
    }).populate("userId");

    // Fetch the personal info (only userId, firstname, lastname)
    const combinedData = await Promise.all(
      students.map(async (student) => {
        const personal = await PersonalInfo.findOne(
          { userId: student.userId },
          "userId firstName lastName"
        );

        console.log("personal: ", personal);

        if (personal) {
          personal.firstName =
            personal.firstName && personal.firstName !== "N/A"
              ? decrypt(personal.firstName)
              : "N/A";
          personal.lastName =
            personal.lastName && personal.lastName !== "N/A"
              ? decrypt(personal.lastName)
              : "N/A";
        }

        return { personal };
      })
    );

    // Sort and filter out null personal data
    const sortedData = combinedData
      .filter((data) => data.personal !== null)
      .sort((a, b) => {
        const nameA = (a.personal?.lastName || "") + (a.personal?.firstName || "");
        const nameB = (b.personal?.lastName || "") + (b.personal?.firstName || "");
        return nameA.localeCompare(nameB);
      });

    res.json(sortedData);
  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(404).json({ error: "Error fetching data" });
  }
});

router.get("/staff", async (req, res) => {
  try {
    // Fetch all staff members (adjust the query if necessary)
    const staffMembers = await User.find({ role: "staff" }); // Assuming there's a role field to distinguish staff

    // Fetch personal info for each staff member
    const combinedData = await Promise.all(
      staffMembers.map(async (staff) => {
        const personal = await PersonalInfo.findOne(
          { userId: staff._id }, // Adjusted to use the correct ID reference
          "userId firstName lastName"
        );

        if (personal) {
          personal.firstName =
            personal.firstName && personal.firstName !== "N/A"
              ? decrypt(personal.firstName)
              : "N/A";
          personal.lastName =
            personal.lastName && personal.lastName !== "N/A"
              ? decrypt(personal.lastName)
              : "N/A";
        }

        return {
          personal,
        };
      })
    );

    res.json(combinedData);
  } catch (err) {
    console.error("Error fetching data:", err);
    res.status(404).json({ error: "Error fetching data" });
  }
});

// In your routes file
router.get("/search", async (req, res) => {
  try {
    const { name } = req.query;
    const regex = new RegExp(name, "i");

    if (!name) {
      return res.status(400).json({ error: "Cannot search without a name" });
    }

    const students = await PersonalInfo.find({}).exec(); // Fetch all students

    const combinedData = await Promise.all(
      students.map(async (student) => {
        let firstName = student.firstName ?? null; // Default to null if undefined
        let lastName = student.lastName ?? null; // Default to null if undefined

        // Check if the values are valid for decryption
        if (firstName && firstName !== "N/A") {
          firstName = decrypt(firstName);
        }

        if (lastName && lastName !== "N/A") {
          lastName = decrypt(lastName);
        }

        // Check if decrypted firstName or lastName matches the regex
        if (
          firstName &&
          lastName &&
          (firstName.match(regex) || lastName.match(regex))
        ) {
          return {
            personal: {
              userId: student.userId,
              firstName, // Use decrypted firstName
              lastName, // Use decrypted lastName
            },
          };
        }
        return null; // Return null if no match
      })
    );

    // Filter out null values (students that didn't match)
    const filteredData = combinedData.filter((student) => student !== null);

    if (filteredData.length > 0) {
      res.status(200).json(filteredData);
    } else {
      res.status(404).json({ error: "No students found" });
    }
  } catch (error) {
    console.error("Error searching students:", error);
    res.status(500).json({ error: "Error searching students" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const Id = req.params.id;
    const currentUser = req.user;
    const updatedFields = req.body;

    // Check user authorization
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const originalDocument = await MedicalInfo.findOne({ userId: Id }).lean();

    if (!originalDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Decrypt original document fields
    const decryptedDocument = {};
    for (const key in originalDocument) {
      if (key === "_id" || key === "userId" || key === "timestamp" || key === "__v") {
        decryptedDocument[key] = originalDocument[key];
      } else {
        const originalValue = originalDocument[key];
        decryptedDocument[key] = originalValue === "N/A" || originalValue === null || originalValue === undefined
          ? originalValue
          : decrypt(originalValue);
      }
    }

    // Identify the changed fields
    const changedFields = {};
    for (const key in updatedFields) {
      if (key === "_id" || key === "userId" || key === "timestamp") continue;

      const originalValue = decryptedDocument[key];
      const newValue = updatedFields[key];

      // Log to compare decrypted original value with the new one
      console.log(`Key: ${key}, Original (decrypted): ${originalValue}, New: ${newValue}`);

      if (originalValue !== newValue) {
        changedFields[key] = encrypt(newValue); // Encrypt and add to changedFields
      }
    }
    console.log("Changed fields:", changedFields);

    if (Object.keys(changedFields).length > 0) {
      const medical = await MedicalInfo.findOneAndUpdate(
        { userId: Id },
        { $set: changedFields },
        { new: true }
      );

      // Find or create the archive document
      // Find existing archive document for this record
      let archive = await Archive.findOne({ documentId: Id });
      console.log("sdsad", archive);
      if (!archive) {
        archive = await Archive.create({
          documentId: Id,
          collectionName: "Medical Records",
          originalDocument: decryptedDocument
        });
      }

      await ArchiveChange.create({
        archiveId: archive._id,
        userId: currentUser._id,
        changedFields: Object.fromEntries(
          Object.entries(changedFields).map(([key, value]) => [
            key,
            { old: encrypt(decryptedDocument[key]), new: value },
          ])
        ),
      });
      // Decrypt the updated medical record for the response
      const updatedDecryptedMedical = {};
      for (const [key, value] of Object.entries(medical.toObject())) {
        if (key === "_id" || key === "userId" || key === "timestamp" || key === "__v") {
          updatedDecryptedMedical[key] = value;
        } else {
          updatedDecryptedMedical[key] = value === "N/A" || value === null || value === undefined
            ? value
            : decrypt(value);
        }
      }

      res.status(200).json({
        message: "Document updated successfully",
        medical: updatedDecryptedMedical
      });
    } else {
      res.status(200).json({
        message: "No changes detected",
        medical: decryptedDocument
      });
    }
  } catch (err) {
    console.error("Error updating document:", err);
    res.status(500).json({ error: "Error updating document" });
  }
});

router.post("/immunization", async (req, res) => {
  try {
    const currentUser = req.user;
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorize" });
    }
    const { medicalInfoId, vaccine, remarks } = req.body;

    const encryptedVaccine = encrypt(vaccine);
    const encryptedRemarks = encrypt(remarks);

    const newImmunization = await Immunization.create({
      medicalInfoId,
      userId: currentUser._id,
      vaccine: encryptedVaccine,
      remarks: encryptedRemarks,
    });
    res.status(200).json(newImmunization);
  } catch (err) {
    console.error("Error searching students:", err);
    res.status(500).json({ error: "Error adding immunization on student" });
  }
});

router.patch("/immunization/:id", async (req, res) => {
  try {
    const Id = req.params.id;
    const currentUser = req.user;
    const updatedFields = req.body;
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorize" });
    }

    const originalDocument = await Immunization.findOne({ _id: Id }).lean();

    if (!originalDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    const decryptedDocument = {};
    for (const key in originalDocument) {
      if (
        key === "_id" ||
        key === "userId" ||
        key === "timestamp" ||
        key === "__v"
      ) {
        decryptedDocument[key] = originalDocument[key]; // Retain these fields as is
      } else {
        decryptedDocument[key] = decrypt(originalDocument[key]); // Decrypt other fields
      }
    }

    const changedFields = {};
    for (const key in updatedFields) {
      if (key === "_id" || key === "userId" || key === "timestamp") {
        continue; // Skip these fields
      }
      const originalValue = decryptedDocument[key];
      const newValue = updatedFields[key];

      // Compare the decrypted original value with the new value
      if (originalValue !== newValue) {
        const encryptedValue = encrypt(newValue); // Encrypt the new value
        changedFields[key] = encryptedValue; // Add the encrypted value to changedFields
      }
    }

    const existingAssessment = await Immunization.findByIdAndUpdate(
      Id,
      { $set: changedFields },
      { new: true }
    );

    // Find existing archive document for this record
    let archive = await Archive.findOne({ documentId: Id });
    if (!archive) {
      archive = await Archive.create({
        documentId: Id,
        collectionName: "Immunization Records",
        originalDocument: decryptedDocument
      });
    }

    await ArchiveChange.create({
      archiveId: archive._id,
      userId: currentUser._id,
      changedFields: Object.fromEntries(
        Object.entries(changedFields).map(([key, value]) => [
          key,
          { old: encrypt(decryptedDocument[key]), new: value },
        ])
      ),
    });

    res.status(200).json(existingAssessment);
  } catch (err) {
    console.error("Error updating assessment:", err);
    res.status(500).json({ error: "Error updating assessment of student" });
  }
});



router.post("/assessment", async (req, res) => {
  try {
    const currentUser = req.user;
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorize" });
    }
    const { medicalInfoId, complaints, actions } = req.body;

    // Encrypt complaints and actions before saving
    const encryptedComplaints = encrypt(complaints);
    const encryptedActions = encrypt(actions);

    // Save the encrypted data
    const assessment = await Assessment.create({
      medicalInfoId,
      userId: currentUser._id,
      complaints: encryptedComplaints,
      actions: encryptedActions,
    });

    // Decrypt data before sending the response to the client
    const decryptedAssessment = {
      ...assessment._doc, // Spread the document (._doc ensures mongoose fields are properly extracted)
      complaints: decrypt(assessment.complaints), // Decrypt complaints
      actions: decrypt(assessment.actions),       // Decrypt actions
    };

    res.status(201).json(decryptedAssessment);  // Send the decrypted data back to the frontend
  } catch (err) {
    console.error("Error adding assessment:", err);
    res.status(500).json({ error: "Error adding assessment" });
  }
});

router.patch("/assessment/:id", async (req, res) => {
  try {
    const Id = req.params.id;
    const currentUser = req.user;
    const updatedFields = req.body;

    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorize" });
    }

    // Fetch the original document
    const originalDocument = await Assessment.findOne({ _id: Id }).lean();

    if (!originalDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Decrypt the original document
    const decryptedDocument = Object.fromEntries(
      Object.entries(originalDocument).map(([key, value]) =>
        ['_id', 'userId', 'timestamp', '__v'].includes(key)
          ? [key, value]
          : [key, decrypt(value)]
      )
    );

    const changedFields = {};
    const updates = {};
    for (const [key, newValue] of Object.entries(updatedFields)) {
      // Avoid updating fields like _id, userId, timestamp
      if (!['_id', 'userId', 'timestamp'].includes(key) && decryptedDocument[key] !== newValue) {
        // Only create a single layer for changedFields without nesting
        changedFields[key] = {
          old: encrypt(decryptedDocument[key]),
          new: encrypt(newValue)
        };
        updates[key] = encrypt(newValue);
      }
    }


    // Update the assessment
    const updatedAssessment = await Assessment.findByIdAndUpdate(
      Id,
      { $set: updates },
      { new: true }
    );

    // Update or create archive
    let archive = await Archive.findOne({ documentId: Id });
    if (!archive) {
      archive = await Archive.create({
        documentId: Id,
        collectionName: "Assessment Records",
        originalDocument: decryptedDocument,
      });
    }


    // Create archive change
    if (Object.keys(changedFields).length > 0) {
      await ArchiveChange.create({
        archiveId: archive._id,
        userId: currentUser._id,
        changedFields,
        timestamp: new Date()
      });
    }

    console.log("Changed fields: ", JSON.stringify(changedFields, null, 2) + " " + Id);


    // Prepare response
    const response = {
      _id: updatedAssessment._id,
      userId: updatedAssessment.userId,
      timestamp: updatedAssessment.timestamp,
      complaints: decrypt(updatedAssessment.complaints),
      actions: decrypt(updatedAssessment.actions),
      changedFields
    };



    res.status(200).json(response);
  } catch (err) {
    console.error("Error updating assessment:", err);
    res.status(500).json({ error: "Error updating assessment of student" });
  }
});



router.post("/assessment/:id/followup", async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { followUpComplaints, followUpActions, date } = req.body;
    const currentUser = req.user;
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorize" });
    }
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const newFollowUp = {
      userId: currentUser._id,
      followUpComplaints: encrypt(followUpComplaints),
      followUpActions: encrypt(followUpActions),
      date: new Date() || null,
    };


    if (!assessment.followUps) {
      assessment.followUps = {};
    }

    // Assign the new follow-up data to followUps
    assessment.followUps = newFollowUp;

    const updatedAssessment = await assessment.save();

    // Create or update archive
    let archive = await Archive.findOne({ documentId: assessmentId });
    if (!archive) {
      archive = await Archive.create({
        documentId: assessmentId,
        collectionName: "Assessment Records",
        originalDocument: assessment,
      });
    }

    // Record the changes in the archive
    await ArchiveChange.create({
      archiveId: archive._id,
      userId: currentUser._id,
      changedFields: {
        followUps: {
          old: encrypt(JSON.stringify(assessment.followUps)),
          new: encrypt(JSON.stringify(newFollowUp)),
        },
      },
      timestamp: new Date(),
    });

    res.status(201).json({
      _id: updatedAssessment._id,
      followUps: {
        ...updatedAssessment.followUps,
        followUpComplaints: decrypt(updatedAssessment.followUps.followUpComplaints),
        followUpActions: decrypt(updatedAssessment.followUps.followUpActions),
        date: updatedAssessment.followUps.date || "",
      },
    });

  } catch (err) {
    console.error("Error adding follow-up:", err);
    res.status(500).json({ error: "Error adding follow-up" });
  }
});


router.patch("/assessment/:id/followup", async (req, res) => {
  try {
    const assessmentId = req.params.id;
    const { followUpComplaints, followUpActions } = req.body;
    const currentUser = req.user;
    if (currentUser.role !== "admin" && currentUser.role !== "staff") {
      return res.status(403).json({ error: "Not authorize" });
    }
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const encryptedFollowUpComplaints = encrypt(followUpComplaints);
    const encryptedFollowUpActions = encrypt(followUpActions);

    assessment.followUps = {
      userId: currentUser._id,
      followUpComplaints: encryptedFollowUpComplaints,
      followUpActions: encryptedFollowUpActions,
    };

    // Save the updated assessment
    const updatedAssessment = await assessment.save();
    console.log("Updated ", updatedAssessment);
    res.status(200).json({ message: "Updated", updatedAssessment });
  } catch (err) {
    console.error("Error adding follow-up:", err);
    res.status(500).json({ error: "Error adding follow-up" });
  }
});
module.exports = router;
