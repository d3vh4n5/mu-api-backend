import { Router } from "express";
import { LauncherController } from "../controllers/launcher.controller.js";
const router = Router();

router.get('/servers', LauncherController.getServers)

export default router;