import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'
import dotenv from "dotenv"

dotenv.config();
// Configure the cloudinary
cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret:process.env.CLOUDINARY_API_SECRET,
});


const uploadOnCloudinary = async (localFilePath)=>{
    try {
        if(!localFilePath) {return null;}
        const response = await cloudinary.uploader.upload(
            localFilePath,{
            resource_type: 'auto',
        })
        console.log("File uploaded on cloudinary .File src :" + response.url);
        // once the file is uploaded, we would like to delete it from the server
        fs.unlinkSync(localFilePath);
        return response;
    } catch (error) {
        console.error("Error occurred while uploading to cloudinary", error);
        fs.unlinkSync(localFilePath);
        return null;
    }
}

const deleteFromCloudinary = async (publicId)=>{
    try {
        if(!publicId) {return null;}
       const result = await cloudinary.uploader.destroy(publicId)

       console.log("File deleted from cloudinary", result);
       return result;
    } catch (error) {
        console.log("Error occurred while deleting from cloudinary", error);
        return null;
    }
}

export {uploadOnCloudinary , deleteFromCloudinary};