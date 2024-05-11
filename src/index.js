// require("dotenv").config({path:'./env'});

// import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

// dotenv.config({ path: "./env" });
connectDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`Server is running on port ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error("error in connecting mongodb  : index.js", error.message);
  });























































// import mongoose from "mongoose";  for approach 1
// import { DB_NAME } from "./constants";
// import express from "express";
// APPROACH 1
// const app = express();
// (async () => {
//   try {
//     await mongoose.connect(`${process.env.MONDO_DB_URI}/${DB_NAME}`);
//     app.on("error", (err) => {
//       /* this is an event listener attached to the app object. It listens for an "error" event. When an "error" event is emitted on the app object, the callback function is called with the error object as its argument.
//       However, in Express.js, the app object doesn't emit an "error" event. The "error" event is usually emitted by servers and streams when an error occurs. In your case, you might want to attach the "error" event listener to the server returned by app.listen()*/
//       console.log("error", err.message);
//       throw err;
//     });

//     app.listen(process.env.PORT, () => {
//       console.log(`Server is running on port ${process.env.PORT}`);
//     });
//   } catch (error) {
//     console.error("error", error.message);
//     throw error;
//   }
// })();
