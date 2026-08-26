import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import {
  createManifest,
  createManifestTrailMaterial,
  joinManifest,
  lookupManifestByRoomCode,
  listAvailableTrails,
  listMountains,
  listManifestPeople,
  listManifestRequirements,
  listManifestTrailMaterials,
  listManifestTrail,
  listMyGroups,
} from "./manifest.controller";

const router = Router();

router.get("/available-trails", authenticateToken, requireRole(["organizer"]), listAvailableTrails);
router.get("/available-mountains", authenticateToken, requireRole(["organizer"]), listMountains);
router.post("/create", authenticateToken, requireRole(["organizer"]), createManifest);
router.post("/join", authenticateToken, requireRole(["hiker"]), joinManifest);
router.get("/lookup", authenticateToken, requireRole(["hiker"]), lookupManifestByRoomCode);
router.get("/mine", authenticateToken, requireRole(["hiker"]), listMyGroups);
router.get("/:manifestId/people", authenticateToken, listManifestPeople);
router.get("/:manifestId/requirements", authenticateToken, listManifestRequirements);
router.get("/:manifestId/trail-materials", authenticateToken, listManifestTrailMaterials);
router.get("/:manifestId/trail", authenticateToken, listManifestTrail);
router.post("/:manifestId/trail-materials", authenticateToken, requireRole(["lgu_official"]), createManifestTrailMaterial);

export default router;
