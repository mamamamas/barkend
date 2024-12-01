require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { mongodUrl, atlasUrl, port } = require("./utils/config");
const jwtSecret = process.env.JWT_SECRET;
console.log("JWT Secret in config:", jwtSecret);
const userRoute = require("./routes/user");
const adminRoute = require("./routes/admin");
const medicalRoute = require("./routes/medical");
const archiveRoute = require("./routes/archive");
const postRoute = require("./routes/post");
const notifRoute = require("./routes/notification");
const eventRoute = require("./routes/event");
const requestFormRoute = require("./routes/request-form");
const scheduleRoute = require("./routes/schedule");
const stockRoute = require("./routes/stock");
const chartRoute = require("./routes/charts");
const posterRoute = require("./routes/poster");
const googleRoute = require("./routes/google");
const passport = require("./utils/passport");
const auth = require("./middlewares/jwtAuth");
const {
  changeStreamOffline,
  restartChangeStreamOffline,
} = require("./utils/CS-config");

const app = express();

const startServer = async () => {
  mongoose
    .connect(atlasUrl)
    .then(() => {
      app.listen(port, () => {
        console.log(`Connected to DB, listening on port: ${port}`);
      });
    })
    .catch((err) => {
      console.log("Error:", err);
    });

  // try {
  //   await changeStreamOffline();
  // } catch (err) {
  //   console.log("Change Stream error: ", err);
  //   await restartChangeStreamOffline();
  // }

  app.use(
    cors({
      origin:
        process.env.NODE_ENV === "production"
          ? "https://barkend-1.onrender.com"
          : "mongodb://localhost:27017/",
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
    })
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use(passport.initialize());

  app.use("/", userRoute);
  app.use("/medical", auth, medicalRoute);
  app.use("/archive", auth, archiveRoute);
  app.use("/post", auth, postRoute);
  app.use("/notification", auth, notifRoute);
  app.use("/events", auth, eventRoute);
  app.use("/request-form", auth, requestFormRoute);
  app.use("/schedule", auth, scheduleRoute);
  app.use("/admin", auth, adminRoute);
  app.use("/stocks", auth, stockRoute);
  app.use("/charts", auth, chartRoute);
  app.use("/poster", auth, posterRoute);
  app.use("/login", auth, googleRoute);
};

startServer();
