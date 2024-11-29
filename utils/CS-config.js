const { atlasUrl, mongodUrl } = require("../utils/config");
const mongoose = require("mongoose");
const OfflineOperation = require("../models/sync/offlineOperation");
const SyncControl = require("../models/sync/syncControl");

let isChangeStreamrunning = false;
let lastSyncFlagUpdate = null;

const changeStreamOffline = async () => {
  try {
    const atlasConn = await mongoose.createConnection(atlasUrl);
    const atlasDB = atlasConn.useDb("test");
    console.log("Connected to Atlas MongoDB");

    const changeStream = atlasDB.watch();
    isChangeStreamrunning = true;
    console.log("Watching Changes on all collections in atlas database.");

    changeStream.on("change", async (change) => {
      if (!isChangeStreamrunning) {
        return;
      }

      try {
        console.log("Change detected:", change);
        const collectionName = change.ns.coll;
        if (change.ns.coll === "offlineoperations") {
          return;
        }

        // Prepare the document for saving based on the operation type
        let document;
        switch (change.operationType) {
          case "insert":
            document = { ...change.fullDocument, timestamp: new Date() };
            break;

          case "update":
            document = {
              _id: change.documentKey._id,
              ...change.updateDescription.updatedFields,
              timestamp: new Date(),
            };
            break;

          case "replace":
            document = { ...change.fullDocument, timestamp: new Date() };
            break;

          case "delete":
            document = { _id: change.documentKey._id }; // For deletes, only _id is available
            break;

          default:
            console.log("Unhandled change operation:", change.operationType);
            return;
        }

        await OfflineOperation.create({
          operationType: change.operationType,
          collectionName: collectionName,
          document: document,
          timestamp: new Date(),
        });

        console.log(`Document ${change.operationType}d in ${collectionName}`);
      } catch (err) {
        console.error("Error processing change locally:", err);
      }
    });

    changeStream.on("error", async (error) => {
      console.error("Change stream error:", error);
      isChangeStreamrunning = false;
      await restartChangeStreamOffline(); // Implement your restart logic here
    });
  } catch (err) {
    console.error("Error setting up change stream:", err);
  }
};

const stopChangeStreamOffline = () => {
  isChangeStreamrunning = false;
};

const restartChangeStreamOffline = async () => {
  console.log("CS-config: Restarting offline change stream");
  await stopChangeStreamOffline();
  await changeStreamOffline();
};

module.exports = {
  changeStreamOffline,
  stopChangeStreamOffline,
  restartChangeStreamOffline,
};
