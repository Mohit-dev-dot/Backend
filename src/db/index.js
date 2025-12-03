import mongoose from "mongoose";
// import {DB_NAME} from "../constants.js"; // DB_NAME is no longer needed here

const connectDB = async () => {
    try {
        // FIX: Remove the manual appending of /DB_NAME
        // Use the MONGO_URL variable directly as it's already complete.
        console.log("🧭 Connecting to:", process.env.MONGO_URL); 
        
        // FIX: Use process.env.MONGO_URL directly
        const connectionInstance = await mongoose.connect(process.env.MONGO_URL);
        
        console.log(`\n MongoDB connected !! DB Host:${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("MongoDB Connection ERROR: ", error);
        process.exit(1);
    }
};

export default connectDB;