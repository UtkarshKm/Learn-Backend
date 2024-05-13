import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_API_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      return null;
    }

    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    // console.log("file uploaded", result.url);
    fs.unlinkSync(localFilePath); // removes the locally saved temp file after upload
    return result;
  } catch (error) {
    fs.unlinkSynk(localFilePath) // removes the locally saved temp file as upload failed
    return null;
  }
};

export default uploadOnCloudinary;
