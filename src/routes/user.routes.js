import dotenv from 'dotenv';
import { Router } from "express";
import { loginUser, registerUser, logoutUser , refreshAccessToken} from "../controllers/user.controllers.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verfiyJWT } from "../middlewares/auth.middleware.js";
dotenv.config();

const router = Router();

router.post(
  "/register",
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 }
  ]),
  (req, res, next) => {
    console.log("FILES RECEIVED IN REGISTER:", req.files);
    next();
  },
  registerUser
);

router.post("/login", (req, res, next) => {
  console.log("REQ.BODY RECEIVED:", req.body);
  next();
}, loginUser);

router.post("/logout", verfiyJWT, logoutUser);

router.post("/refresh-Token",refreshAccessToken)

export { router };
