// users [icon:user]{
//     id string pk
//     createdAt Date
//     updatedAt Date
//     watchHistroy ObjectId[] videos
//     username string
//     email string
//     fullname string
//     coverImage string
//     avatar string
//     password string
//     refreshToken string
//     }

// import mongoose , {Schema} from "mongoose";
// import bcrypt from "bcrypt";
// import jwt from "jsonwebtoken";

// const userSchema = new Schema(
//     {
//         username:{
//             type:String,
//             required:true,
//             unique:true,
//             lowercase:true,
//             trim:true,
//             index:true
//         },
//         email:{
//             type:String,
//             required:true,
//             unique:true,
//             lowercase:true,
//             trim:true
//         },
//         fullname:{
//             type:String,
//             required:true,
//             index:true,
//             trim:true
//         },
//         avatar:{
//             type:String,// cloudinary URL
//             required:true
//         },
//         coverImage:{
//             type:String,// cloudinary URL
//         },
//         watchHistory:[
//             {
//                 type:Schema.Types.ObjectId,
//                 ref:"Video"
//             }
//         ],
//         password:{
//             type:String,
//             required:[true,"password is required"],
//         },
//         refreshToken:{
//             type:String
//         }


//     },
//     { timestamps:true}
// )

// // we use pre hooks to save password in secret way
// userSchema.pre("save",async function(next){

//     if(!this.isModified("password")) {return next();}

//     this.password = bcrypt.hash(this.password,10) // password is changing 
//     // 10 is the no of rounds password is change

//     next() // this is use to pass from one middleware to another . this is the third parameter
// })

// userSchema.methods.isPasswordCorrect = async function(password){
//    return await bcrypt.compare(password,this.password) 
// }

// // access tokens using jwt
// // generate access tokens using JWT token
// userSchema.methods.generateAccessToken =  function(){
//     // short lived access tokens
//    return jwt.sign({
//         _id : this._id,
//         email: this.email,
//         username: this.username,
//         fullname: this.fullname
//     },process.env.ACCESS_TOKEN_SECRET,{expiresIn: process.env.ACCESS_TOKEN_EXPIRY}) // this access token will expire 
// }

// // refresh tokens from jwt
// // refresh token only have one parameter
// userSchema.methods.generateRefreshToken =  function(){
//     // long lived access tokens like 10 days
//    return jwt.sign({
//         _id : this._id,
//     },process.env.REFRESH_TOKEN_SECRET,{expiresIn: process.env.REFRESH_TOKEN_EXPIRY}) // this access token will expire 
// }




// export const User = mongoose.model("User",userSchema); // by this we use functions of mongoose like find etc...





import mongoose, {Schema} from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken"

const userSchema = new Schema(
    {
        username : {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true
        },
        email: {
            type:String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullname: {
            type:String,
            required: true,
            trim: true,
            index: true,
        },
        avatar:{
            type: String, //url
            required: true
        },
        coverImage:{
            type: String, //url
        },
        watchHistory:[
            {
                type:Schema.Types.ObjectId,
                ref: "Video"
            }
        ],
        password: {
            type: String,
            required:[true,"Passowrd is required"]
        },
        refreshToken:{
            type: String
        },

    },
    {timestamps: true} //createdAT and updatedAt automatically aajayega
)

userSchema.pre("save",async function (next){
    if(!this.isModified("password")) return next()
    this.password = bcrypt.hash(this.password,10 )
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){
   return await  bcrypt.compare(password,this.password)
}

userSchema.methods.generateAccessToken = function (){
    //short lived access token
  return jwt.sign({
        _id : this._id,
        email: this.email,
        username: this.username,
        fullname: this.fullname,
    },process.env.ACCESS_TOKEN_SECRET, {expiresIn: process.env.ACCESS_TOKEN_EXPIRY});
}

userSchema.methods.generateRefreshToken = function (){
    //short lived access token
    return jwt.sign({
        _id : this._id,
    },process.env.REFRESH_TOKEN_SECRET, {expiresIn: process.env.REFRESH_TOKEN_EXPIRY});
}

export const User= mongoose.model("User",userSchema)