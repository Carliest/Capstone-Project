import { Router } from "express";
import { authenticateToken } from "../../middlewares/auth.middleware";
import {
  createHazardLog,
  createSOSAlert,
  logCheckpointPassage,
} from "./tracking.controller";

const router = Router();

router.post("/checkpoint-log", authenticateToken, logCheckpointPassage);
router.post("/hazard", authenticateToken, createHazardLog);
router.post("/sos", authenticateToken, createSOSAlert);

export default router;
