import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import {
  approveManifest,
  createGuide,
  createCheckpointStation,
  createMountain,
  createTrail,
  deleteGuide,
  listCheckpointStations,
  listGuides,
  listMountains,
  listTrails,
  submitLguAccessRequest,
  updateOwnLguCredentials,
} from "./lgu.controller";

const router = Router();

router.post("/access-requests", submitLguAccessRequest);
router.get("/mountains", authenticateToken, requireRole(["lgu_official"]), listMountains);
router.post("/mountains", authenticateToken, requireRole(["lgu_official"]), createMountain);
router.get("/trails", authenticateToken, requireRole(["lgu_official"]), listTrails);
router.post("/trails", authenticateToken, requireRole(["lgu_official"]), createTrail);
router.get("/checkpoint-stations", authenticateToken, requireRole(["lgu_official"]), listCheckpointStations);
router.post("/checkpoint-stations", authenticateToken, requireRole(["lgu_official"]), createCheckpointStation);
router.get("/guides", authenticateToken, requireRole(["lgu_official"]), listGuides);
router.post("/guides", authenticateToken, requireRole(["lgu_official"]), createGuide);
router.delete("/guides/:guideId", authenticateToken, requireRole(["lgu_official"]), deleteGuide);
router.patch("/account/credentials", authenticateToken, requireRole(["lgu_official"]), updateOwnLguCredentials);
router.patch(
  "/manifests/:manifestId/approve",
  authenticateToken,
  requireRole(["lgu_official"]),
  approveManifest
);

export default router;
