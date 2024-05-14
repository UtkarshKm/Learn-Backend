//verify if user is active / login

import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

const verifyJwt = asyncHandler(async (req,_, next) => {
  try {
    const token =
      req.cookies?.accessToken ||
      req.headers["Authorization"]?.replace("Bearer ", "");

    if (!token) {
      throw new ApiError(401, "Unauthorized request ");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const decodedToken = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET,
      options
    );

    const user = await User.findById(decodedToken._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      throw new ApiError(401, "Unauthorized request : user not found");
    }

    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(
      401,
      error?.message || "Unauthorized request : verifyJwt"
    );
  }
});

export default verifyJwt;
