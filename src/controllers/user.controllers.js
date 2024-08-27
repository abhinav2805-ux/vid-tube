import {asyncHandler} from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js";
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"


const generateAccessAndRefreshToken = async(userId)=>{
    try {
          const user = await User.findById(userId)
          
          if(!user){
            throw new ApiError(401,"User not found");
          }
    
         const accessToken = user.generateAccessToken();
         const refreshToken = user.generateRefreshToken();
    
         user.refreshToken = refreshToken;
         await user.save({validateBeforeSave:false})
         return {accessToken,refreshToken}
    
    } catch (error) {
        throw new ApiError(500,"something went wrong while saving generated token")
    }

}



const registerUser = asyncHandler(async(req,res)=>{
    const {fullname,email,username,password} = req.body
    
    // validation
    if(
        [fullname,email,username,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"fullName is required");
    }

    // check existing user
    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })

    if(existedUser){
        throw new ApiError(400,"user with email or username already exists");
    }

    // store avatars
   const avatarLocalPath =  req.files?.avatar?.[0]?.path
   const coverLocalPath =  req.files?.coverImage?.[0]?.path

   if(!avatarLocalPath){
    throw new ApiError(400,"Avatars file is missing")
   }

//    const avatar = await uploadOnCloudinary(avatarLocalPath) 
//    let coverImage = ""
//    if(coverLocalPath){
//     coverImage = await uploadOnCloudinary(coverLocalPath) 
//    }

let avatar;
try{
   avatar = await uploadOnCloudinary(avatarLocalPath)
   console.log(avatar,"upload avatar file")
}catch(error){
    console.log("error uploading avatars",error)
    throw new ApiError(500," fail to upload avatars")
}

let coverImage;
try{
    coverImage = await uploadOnCloudinary(coverLocalPath)
   console.log(coverImage,"upload cover image file")
}catch(error){
    console.log("error uploading cover iamge",error)
    throw new ApiError(500," fail to upload coverimage")
}

   // user created
  try {
     const user = await User.create({
      fullname,
      email,
      username:username.toLowerCase(),
      password,
      avatar:avatar.url,
      coverImage:coverImage?.url || "",
     })
  
     // now this user has no password and refreshtoken fields 
    const createUser = await User.findBtId(user._id).select(
      "-password -refreshToken"
    )
  
    if(!createUser){
      throw new ApiError(500,"Something went wrong, while creating user")
      }
  
      return res
          .status(201)
          .json(new ApiResponse(200,createUser,"User registered successfully"))
  } catch (error) {
    console.log("user creation is failed")
    if(avatar){
        await deleteFromCloudinary(avatar.public_id)
    }
    if(coverImage){
        await deleteFromCloudinary(coverImage.public_id)
    }
    throw new ApiError(500,"Something went wrong, while creating user and images were deleted successfully")

  }
}) 

// route
const loginUser = asyncHandler(async (req, res) => {

    // get data from body
    const { email,username, password } = req.body

    // validations
    if(!email || !username || !password){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(401,"Invalid credentials")
    }

    // validate password
   const isPasswordValid = await User.isPasswordCorrect(password)
   if(!isPasswordValid) {
    throw new ApiError(401,"Invalid credentials")
   }

   // generate tokens
   const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

   const loggedInUser = await User.findById(user._id)
   .select(
        "-password -refreshToken"
   );

   if(!loggedInUser) {
    throw new ApiError(500,"Something went wrong, while fetching user")
   }

   const options = {
    httpOnly:true,
    secure:process.env.NODE_ENV === 'production',
   }

   return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(new ApiResponse(200,
        {user: loggedInUser, accessToken,refreshToken},
        "Logged in successfully"
    ))
})


const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
      
        req.user.id,
        {
            $set:{
                refreshToken:undefined,
            }
        },
        {
            new:true,
        }
        
    )

    const options = {
        httpOnly:true,
        secure:process.env.NODE_ENV === 'production',
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200,{},"Logged out successfully"));
})


const refreshAccessToken = asyncHandler(async (req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken ;
    if(!incomingRefreshToken){
        throw new ApiError(401,"No refresh token provided")
    }

    try {
       const decodedToken =  jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
       const user =  await User.findById(decodedToken?._id)
       
       if(!user){
        throw new ApiError(401,"Invalid refresh token")
       }

       if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401,"Invalid refresh token")
       }

       const options = {
         httpOnly:true,
         secure:process.env.NODE_ENV === 'production',
    }
       // generate tokens
       const {accessToken, refreshToken:newRefreshToken} = await generateAccessAndRefreshToken(user._id)

       return res
       .status(200)
       .cookie("accessToken", accessToken, options)
       .cookie("refreshToken", newRefreshToken, options)
       .json(new ApiResponse(200,{accessToken, refreshToken:newRefreshToken},"Access token refreshed successfully"));

    } catch (error) {
        throw new ApiError(500,"Error generating access token for user: " + error.message)
    }
})


const changeCurrentPassword = asyncHandler (async(req,res)=>{
    const {oldPassword, newPassword} = req.body

   const user = await User.findById(req.User?._id)

   user.isPasswordValid= await user.isPasswordCorrect(oldPassword)

   if(!isPasswordValid){
    throw new ApiError(401,"Old password is incorrect")
   }

   user.password = newPassword

   await user.save({validateBeforeSave:false})
   return res
   .status(200)
   .json(new ApiResponse(200,{},"Password updated successfully"));
})

const getCurrentUser = asyncHandler (async(req,res)=>{
    return res.status(200).json(200,new ApiResponse (req.user,"current user details"));
})

const updateAccountDetails = asyncHandler (async(req,res)=>{
    const {fullname,email} = req.body

    if(!fullname || !email){
        throw new ApiError(400,"fullname and email are required")
    }
   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullname,
                email:email
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    if(!user){
        throw new ApiError(500,"Something went wrong, while updating user")
    }

    return res
   .status(200)
   .json(new ApiResponse(200,user,"User details updated successfully"));
})

const updateUserAvatar = asyncHandler (async(req,res)=>{
   const avatarLocalPath =  req.file?.path

   if(!avatarLocalPath){
    throw new ApiError(400,"Avatars file is missing")
   }
   const avatar = await uploadOnCloudinary(avatarLocalPath)

   if(!avatar.url){
    throw new ApiError(500,"Something went wrong, while uploading avatar")
   }

   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler (async(req,res)=>{
   const coverImageLocalPath = req.file?.path
   if(!coverImageLocalPath){
    throw new ApiError(400,"Cover image file is missing")
   }
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)
   if(!coverImage.url){
    throw new ApiError(500,"Something went wrong, while uploading cover image")
   }
   const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        }
    ,{new :true}).select("-password -refreshToken")

    return res.status(200).json(new ApiResponse(200,user,"Cover image updated successfully"))
})


const getUserChannelProfile = asyncHandler (async(req,res)=>{
   const {username} = req.params

    if(!username?.trim()){
        throw new ApiError(400,"Username is required")
    }

     const channel = await User.aggregate(
        [
            // pipeline 1
            {
                $match:{
                    username:username?.toLowerCase(),
                }
            },
            // pipeline 2
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"channel",
                    as:"subscibers"
                }
            },
            //pipeline 3
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"subscriber",
                    as:"subscribedTo"
                }
            },
            {
                $addFields:{
                    subscribersCount:{
                        $size:"$subscribers"
                    },
                    channelsSubscribedToCount:{
                        $size:"$subscriberedTo"
                    },
                    isSubscribed:{
                        $cond:{
                            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                            then:true,
                            else:false
                        }
                    }
                }
            },
            {
                // Project only the neccessary data
                $project:{
                    username:1,
                    email:1,
                    avatar:1,
                    coverImage:1,
                    fullname:1,
                    subscribersCount:1,
                    channelsSubscribedToCount:1,
                    isSubscribed:1
                }
            }
        ]
     ) 

     if(!channel?.length){
        throw new ApiError(404,"User not found")
    }

    return res.status(200).json( new ApiResponse(200, channel[0],"channels profile fetched successfully "))

})

const getWatchHistory = asyncHandler (async(req,res)=>{
    const user = await User.aggregate([
        // pipeline 1
        {
            $match:{
                _id:new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        // pipeline 2
        {
            $lookup:{
                from:"videos",
                localField:"watchHistory",
                foreignField:"_id",
                as:"watchHistory",
                pipeline:[{
                    $lookup:{
                        from:"users",
                        localField:"owner",
                        foreignField:"_id",
                        as:"owner",
                        pipeline:[{
                            $project:{
                                fullname:1,
                                avatar:1,
                                username:1
                            }
                        }]
                    }
                },
            {
                $addFields:{
                    owner:{
                        $first:"owner"
                    }
                }
            }
        ]
            }
        },
        
    ])
    
    if(!user?.length){
        throw new ApiError(404,"User not found")
    }

    return res.status(200).json(new ApiResponse(200, user[0]?.watchHistory ,"watch history fetched successfully "))

})

export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}