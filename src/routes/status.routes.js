import { Router } from "express";
import { StatusController } from "../controllers/status.controller.js";

const router = Router();

router.get('/', StatusController.getStatus)

export default router;