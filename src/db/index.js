import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONDO_DB_URI}/${DB_NAME}`
    );
    console.log(
      ` \n "MongoDB connected successfully" \n ${connectionInstance.connection.host}} \n ${connectionInstance.connection.name} \n ${connectionInstance.connection.port}`
    );
  } catch (error) {
    console.error("error in connecting mongodb", error.message);
    process.exit(1);
  }
};

export default connectDB;
