import { Router } from "express";
import { AuthController } from "../controllers/auth.controller.js";

const router = Router();

router.post('/register', AuthController.createUser)

export default router;