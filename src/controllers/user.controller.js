import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import { password } from "bun";
import mongoose from "mongoose";

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
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) {
    throw new ApiError(400, " error in uploading coverImage");
  }

  try {
    const updatedCoverImage = await User.findByIdAndUpdate(
      req.user._id,
      {
        coverImage: coverImage.url,
      },
      {
        new: true,
      }
    ).select("-password");

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Cover Image updated successfully",
          updatedCoverImage
        )
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        error.message || new ApiError(500, " failed to update coverImage in db")
      );
  }
});
// add utility to remove image from cloudinary after updating it

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is required");
  }

  const channel = await User.aggregate([
    {
      $match: {
        // username,  // username : username
        username: username.toLowerCase(),
      },
    }, // gives a 1 user from User collection as every username is unique
    {
      $lookup: {
        from: "subscriptions", // use the name which will be used in DB
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    }, // gives all the subscribers of the channel in array of objects

    // channel is using its _id to find it occurrence in channel field of subscriptions collection , which gives  subscribers count.
    {
      $lookup: {
        from: " subscriptions",
        localField: "_id",
        foreignField: "subscribers",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: { $size: "$subscribers" },
        subscribedToCount: { $size: "$subscribedTo" },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscribers.subscribers"], //  subscribers filed me , subscribers  hai jo subscription collection me hai

              //left join me , subscribers  ko add keya and us filed ka name subscribers rakha
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        username: 1,
        email: 1,
        avatar: 1,
        coverImage: 1,
        subscriberCount: 1,
        subscribedToCount: 1,
        isSubscribed: 1,
        password: 0,
        refreshToken: 0,
        fullName: 1,
      },
    },
  ]);
  console.log(channel);
  if (!channel || channel.length === 0) {
    // !channel?.length
    throw new ApiError(404, "Channel not found ");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, "Channel fetched successfully", channel[0]));
});

const getWatchHistory = asyncHandler(async (req, res) => {
  //get id and convert it to object id
  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      username: 1,
                      avatar: 1,
                    },
                  },
                ],
              },
            },
            {
              $addFields: {
                owner: { $arrayElemAt: ["$owner", 0] },
              },
            },
          ],
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          "Watch history fetched successfully",
          user[0].watchHistory
        )
      );
  } catch (error) {
    return res
      .status(500)
      .json(
        error.message || new ApiError(500, " failed to fetch watch history")
      );
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeUserPassword,
  getCurrentUser,
  updateUserProfile,
  updateUserAvatar,
  getUserChannelProfile,
  updateUserCoverImage,
  getWatchHistory,
};
