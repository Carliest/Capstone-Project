import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import {
  createManifest,
  joinManifest,
  listAvailableTrails,
  listMountains,
} from "./manifest.controller";

const router = Router();

router.get("/available-trails", authenticateToken, requireRole(["organizer"]), listAvailableTrails);
router.get("/available-mountains", authenticateToken, requireRole(["organizer"]), listMountains);
router.post("/create", authenticateToken, requireRole(["organizer"]), createManifest);
router.post("/join", authenticateToken, requireRole(["hiker"]), joinManifest);

export default router;
