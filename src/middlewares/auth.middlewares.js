import jwt from "jsonwebtoken";
import {User} from "../models/user.models.js"
import {ApiError} from "../utils/ApiError.js"
import {asyncHandler} from "../utils/asyncHandler.js"

export const verifyJWT = asyncHandler(async(req,_,next)=>{
    const token = req.cookies.accessToken || req.header("Authoruzaion")?.replace("Bearer ","");

    if(!token){
        throw new ApiError(401,"No access token provided")
    }

        try {
           const decodeedToken = jwt.verify(token,process.env.ACCESS_TOKEN_SECRET);

          const user =  await User.findById(decodeedToken?._id).select("-password -refreshToken");

          if(!user){
            throw new ApiError(401,"Unauthorized")
          }

          req.user = user ; 
          next();  // it transfer on middleware to another middleware/route


        } catch (error) {
          throw new ApiError(401,error?.message || "invalid access token")  
        }

})
