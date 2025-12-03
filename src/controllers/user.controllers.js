import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { uploadCloudinary } from "../utils/cloudinary.js"; 
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiErrors } from "../utils/ApiErrors.js";
import fs from "fs"; // Used for local file cleanup
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";



const generateAccessandRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    console.log("TOKEN ERROR:", error);
    throw new ApiErrors(500, "Error generating tokens");
  }
};



export const registerUser = asyncHandler(async (req, res) => {
  const { fullname, email, username, password } = req.body;

  if ([fullname, email, username, password].some((f) => !String(f).trim())) {
    throw new ApiErrors(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiErrors(409, "User with email or username already exists");
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    throw new ApiErrors(400, "Avatar file is required");
  }

  let avatar, coverImage;
  const filesToClean = [];
  filesToClean.push(avatarLocalPath);
  if (coverImageLocalPath) filesToClean.push(coverImageLocalPath);

  try {
    avatar = await uploadCloudinary(avatarLocalPath);
    if (!avatar) throw new ApiErrors(400, "Avatar upload failed");

    if (coverImageLocalPath) {
      coverImage = await uploadCloudinary(coverImageLocalPath);
    }

    const user = await User.create({
      fullname,
      email,
      username: username.toLowerCase(),
      password,
      avatar: avatar.url,
      coverImage: coverImage?.url || "",
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User registered successfully"));
  } catch (error) {
    console.log("REGISTER ERROR:", error);

    // Cleanup temp files on error
    for (const path of filesToClean) {
      try {
        if (fs.existsSync(path)) {
          fs.unlinkSync(path);
          console.log("Deleted temp file:", path);
        }
      } catch (cleanupError) {
        console.error("Cleanup Error:", cleanupError);
      }
    }

    throw error;
  }
});





export const loginUser = asyncHandler(async (req, res) => {
  console.log("LOGIN BODY:", req.body);

  const { email, username, password } = req.body;

  if (!(email || username)) {
    throw new ApiErrors(400, "Email or username is required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiErrors(404, "User not found");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiErrors(400, "Incorrect password");
  }

  const { accessToken, refreshToken } = await generateAccessandRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken },
        "Login successful"
      )
    );
});



export const logoutUser = asyncHandler(async(req,res)=>{

    await User.findByIdAndUpdate(req.user._id,
        {
            $set:{refreshToken:undefined}
        },
        {
            new:true
        }
    )

  const options = {
    httpOnly:true,
    secure:true,
  }

  return res.status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(new ApiResponse(200,{},"User logged out successfully"))

})



export const refreshAccessToken = asyncHandler(async(req,res)=>{

  const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

  if(!incomingRefreshToken)
  {
    throw new ApiErrors(401,"unauthorized request")
  }

  const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)

  const user = User.findById(decodedToken?._id)

  if(!user)
  {
    throw new ApiErrors(400,"Invalid Refresh Token")
  }

  if(incomingRefreshToken != user?.refreshToken)
  {
    throw new ApiErrors(400,"Refresh Token expired or used")
  }

  const options = {
    httpOnly:true,
    secure:true
  }

  const {accessToken,newRefreshToken} = await generateAccessandRefreshTokens(user._id)

  return res.send(200).cookie("acessToken",accessToken,options).cookie("refreshToken",newRefreshToken,options).json(new
    ApiResponse(200,{accessToken,refreshAccessToken:newRefreshToken},"Access Token Refreshed")
  )
})


export const changeCurrentPassword = asyncHandler(async(req,res)=>{
   const {oldPassword,newPassword} = req.body

   const user = await User.findById(req.user?._id)

   const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

   if(!isPasswordCorrect)
   {
    throw new ApiErrors(400,"Invalid Password")
   }

   user.password=newPassword
   await user.save({validateBeforeSave: false})

   return res.status(200).json(new ApiResponse(200,{},"Password Changed Successfully"))

})


export const getCurrentUser = asyncHandler(async(req,res)=>{
  return res.status(200).json(new ApiResponse(200,req.user,"Current User feteched successfully"))
})


export const updateAccountDetails = asyncHandler(async(req,res)=>{
  const {fullname,email} = req.body
  
  if(!fullname || !email)
  {
    throw new ApiErrors(400,"Field required")
  }

  const user = User.findByIdAndUpdate(req.user?._id,
    {
    $set:
    {
      fullname,
      email
    }
  },
    {
      new:true
    }
  ).select("-password")


  return res.status(200).json(new ApiResponse(200,user,"Details Updatted Successfully"))
})


export const updateAvatar = asyncHandler(async(req,res)=>{

  const avatarLocalPath = req.file?.path

  if(!avatarLocalPath)
  {
    throw new ApiErrors(400,"Filed Required")
  }

  const avatar = await uploadCloudinary(avatarLocalPath)

  if(!avatar.url)
  {
    throw new ApiErrors(400,"Error while uploading on cloudinary")
  }

  const user = await User.findByIdAndUpdate(req.user?._id,
    {
      
      $set:{
      avatar:avatar.url
      }
    },
    {new:true}).select("-password")

    return res.status(200).json(new ApiResponse(200,user,"Avatar updated successfully"))


})


export const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath)
    {
      throw new ApiErrors(400,"Field is required")
    }

    const coverImage = await uploadCloudinary(coverImageLocalPath)

    if(!coverImage.url)
    {
      throw new ApiErrors(400,"Error while uploading to cloudinary")
    }

    const user = await User.findByIdAndUpdate(req.user?._id,
      {
        $set:{
          coverImage:coverImage.url
        }
      },
      {new:true}
    ).select("-password")


    return res.status(200).json(new ApiResponse(200,user,"Cover Image updated"))
})

export const getUserChannelProfile = asyncHandler(async(req,res)=>{
  const {username} = req.params

  if(!username?.trim())
  {
    throw new ApiErrors(400,"No user found")
  }



  const channel = await User.aggregate([
    {
      
      $match:{
        username:username.toLowerCase()
      }

    },

    {
      
      $lookup:{
        from:"subscriptions",
        localField:"_id",
        foreignField:"channel",
        as:"subscribers"
      }

    },

    {

      $lookup:{
        from:"subcriptions",
        localField:"_id",
        foreignField:"subscriber",
        as:"subscribedTo"
      } 

    },

    {
      $addFields:
      {
        subscribersCount:
        {
          $size:"$subscribers"
        },

        channelsSubscribedToCount:
        {
          $size:"$subscribedTo"
        },

        
          isSubscribed:
          {
            $cond:
            {
              if:
              {
                $in:[req.user?._id,"$subscribers.subscribe"]
              },
              then:true,
              else:false
            }
          }
        }
      }
    ,

    {
      $project:
      {
        fullname:1,
        username:1,
        subscribersCount:1,
        channelsSubscribedToCount:1,
        isSubscribed:1,
        avatar:1,
        coverImage:1,
        email:1
      }
    }

    

    
  ])

  if(!channel?.length)
  {
    throw new ApiErrors(400,"Channel does not exist")
  }

  return res.status(200).json(new ApiResponse(200,channel[0],"user channel fetched successfully"))
})