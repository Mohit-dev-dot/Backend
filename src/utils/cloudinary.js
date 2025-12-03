import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

dotenv.config();   // Remove path param unless needed

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // SAFE DELETE (prevents silent crashes)
    fs.unlink(localFilePath, (err) => {
      if (err) console.log("File delete error:", err.message);
    });

    return response;

  } catch (error) {
    console.log("Cloudinary upload error:", error.message);

    // SAFE DELETE on failure
    fs.unlink(localFilePath, (err) => {});

    return null;
  }
};
