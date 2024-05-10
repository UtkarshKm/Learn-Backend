import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";



const registerUser = asyncHandler(async (req, res) => {
    res.status(200).json({
        message: "Register User OK ",
    });

    const {fullName, email , username , passsword}  = req.body
    console.log("email :" , email );
    console.log(req.body);

    // if (fullName ==="") {
    //     throw new ApiError (400, "Full Name is required") 
    // } do for other 3  , also good 

    if ([fullName, email , username , passsword].some((field) =>  field?.trim() === "")) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser =  await User.findOne({
        $or: [ {username} , {email}]
    })

    if (existedUser){
        throw new ApiError(409, "Username or Email is already taken")
    }
    
    const avatarLocalPath = req.files?.avatar[0]?.path
    const coverImageLocalPath = req.field?.coverImage[0]?.path
    console.log(req.files);

    if(!avatarLocalPath){
        throw new ApiError(400 , "avatar is required")
    }

    const avatar =  await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError(400 , "avatar is required")
    }
    console.log(avatar);

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || "",
        email,
        passsword,
        username: username.toLowerCase()
    })

    const createduser = await User.findById(user._id).select("-password -refreshToken")

    if(!createduser){
        throw new apiError(500 , "User was not created : user.controller.js")
    }

    return res.status(201).json(
        new ApiResponse(200,"User registered successfully",createduser)
    )
});

export { registerUser };