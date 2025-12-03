import dotenv from 'dotenv';
import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiErrors } from "../utils/ApiErrors.js"
import  jwt from "jsonwebtoken"

dotenv.config();


import { User } from "../models/user.model.js"

export const verfiyJWT = asyncHandler(async (req,res,next)=>{
   const token = req.cookies?.accessToken || req.headers("Authorization")?.replace("Bearer ","")

   if(!token)
   {
    throw new ApiErrors(400,"Unauthorized request")
   }

   const decodedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET)

   const user = await User.findById(decodedToken?._id).select("-password -refreshToken")

   req.user = user
   next()
})