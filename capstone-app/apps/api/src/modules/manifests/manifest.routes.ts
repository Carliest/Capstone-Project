import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import { createManifest, joinManifest } from "./manifest.controller";

const router = Router();

router.post("/create", authenticateToken, requireRole(["organizer"]), createManifest);
router.post("/join", authenticateToken, requireRole(["hiker"]), joinManifest);

export default router;
