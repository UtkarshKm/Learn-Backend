import { Router } from "express";
import {
  changeUserPassword,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateUserAvatar,
  updateUserCoverImage,
  updateUserProfile,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import verifyJwt from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

//secure route
router.route("/logout").post(verifyJwt, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").post(verifyJwt, changeUserPassword);
router.route("/current-user").get(verifyJwt, getCurrentUser);
router
  .route("/update-avatar")
  .patch(verifyJwt, upload.single("update-avatar"), updateUserAvatar);
router
  .route("/update-cover")
  .patch(verifyJwt, upload.single("updateCover"), updateUserCoverImage);
router.route("channel/:username").get(verifyJwt, getUserChannelProfile);
router.route("/update-user").patch(verifyJwt, updateUserProfile);
router.route("/watch-history").get(verifyJwt, getWatchHistory);

export default router;
