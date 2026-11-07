import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { asyncHandler } from "../utils/async-handler.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "../schemas/auth.schemas.js";
import * as controller from "../controllers/auth.controller.js";

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });

router.post("/register", authLimiter, validate(registerSchema), asyncHandler(controller.register));
router.post("/login", authLimiter, validate(loginSchema), asyncHandler(controller.login));
router.post("/logout", authenticate, asyncHandler(controller.logout));
router.get("/me", authenticate, asyncHandler(controller.currentUser));
router.post("/forgot-password", authLimiter, validate(forgotPasswordSchema), asyncHandler(controller.forgotPassword));
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), asyncHandler(controller.resetPassword));

export default router;
