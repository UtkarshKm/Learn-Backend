import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (user_id) => {
  const user = await User.findById(user_id);
  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  user.refreshToken = refreshToken;

  await user.save({ validateBeforeSave: false }); // as we don't have password field
  return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, email, username, password } = req.body;
  console.log(req.body);

  if (
    [fullName, email, username, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "Username or Email is already taken");
  }

  // const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.field?.coverImage[0]?.path;
  // better approach is the above one , but  solves undefined error
  let avatarLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPath = req.files.avatar[0].path;
  }

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // console.log(req.files);

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "avatar is required");
  }
  // console.log("avatar : "  ,avatar);
  // console.log("coverImage : "  ,coverImage);

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new apiError(500, "User was not created : user.controller.js");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, "User registered successfully", createdUser));
});

const loginUser = asyncHandler(async (req, res) => {
  // req data from body
  //username or email
  //find user
  //verify password
  //generate token
  // save them in secure cookies
  // response of successful login

  const { email, password, username } = req.body;

  if (!email && !username) {
    throw new ApiError(400, "Email  or username are required");
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // validate password
  const isPasswordValid = user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Password is incorrect : invalid credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //cookies
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, "User logged in successfully", {
        user: loggedInUser,
        accessToken,
        refreshToken, // for app development
      })
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  //clear cookies and  remove refresh token from db

  //find user -- designing a custom middleware : authMiddleware

  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true, //The ``new: true`` option is used to return the modified document rather than the original. By default, these methods return the original, unmodified document. If you set new: true, you'll get the updated document back in your callback or promise.
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken ||
    req.body.refreshToken ||
    req.headers["refreshToken"]; // encrypted token

  if (!incomingRefreshToken) {
    throw new ApiError(401, " unauthorized request : no refresh token");
  }

  try {
    const decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    ); // refresh token has _id of user

    const dbRefreshToken = await User.findById(decodedRefreshToken._id).select(
      "refreshToken"
    );

    if (!dbRefreshToken) {
      throw new ApiError(401, "Invalid refresh token : user not found");
    }

    if (dbRefreshToken.refreshToken !== incomingRefreshToken) {
      throw new ApiError(
        401,
        "Invalid refresh token : token mismatch or expired"
      );
    }
    const options = {
      httpOnly: true,
      secure: true,
    };

    const { newAccessToken, newRefreshToken } = generateAccessAndRefreshToken(
      decodedRefreshToken._id
    );

    // //add new refresh token to db
    // await User.findByIdAndUpdate(
    //   decodedRefreshToken._id,
    //   {
    //     $set : { refreshToken: newRefreshToken },
    //   },
    //   {
    //     new: true,
    //   }
    // ); not need for this as generateAccessAndRefreshToken will do this but it uses save method instead of set which is better ( set is faster but save is more secure)

    //add new token to cookies
    return res
      .status(200)
      .cookie("accessToken", newAccessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(200, "Access token refreshed successfully", {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken, // for app development
        })
      );
  } catch (error) {
    throw new ApiError(
      401,
      error.message || "Unauthorized request : refreshAccessToken"
    );
  }
});

const changeUserPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw new ApiError(400, "oldPassword and newPassword are required");
  }

  const user = await User.findById(req.user?._id);

  const oldPasswordCheck = user.isPasswordCorrect(oldPassword);

  if (!oldPasswordCheck) {
    throw new ApiError(401, "Old password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "Password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(
    new ApiResponse(200, "Current User fetched successfully ", {
      current: req.user,
    })
  );
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!fullName && !email) {
    throw new ApiError(400, "All fields are required");
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      fullName,
      email,
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, "User updated successfully", updatedUser));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) {
    throw new ApiError(400, " error in uploading avatar");
  }

  try {
    const updatedAvatar = await User.findByIdAndUpdate(
      req.user._id,
      {
        avatar: avatar.url,
      },
      {
        new: true,
      }
    ).select("-password");

    return res
      .status(200)
      .json(new ApiResponse(200, "Avatar updated successfully", updatedAvatar));
  } catch (error) {
    return res
      .status(500)
      .json(
        error.message || new ApiError(500, " failed to update avatar in db")
      );
  }
});

// add functionality to update cover image

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getCurrentUser,
  updateUserProfile,
  updateUserAvatar,
};
