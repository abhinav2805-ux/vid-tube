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


export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser,
}