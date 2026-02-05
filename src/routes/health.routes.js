import { Router } from "express";
import { HealthController } from "../controllers/health.controller.js";

const router = Router();

router.get('/readiness', HealthController.readiness)

export default router;