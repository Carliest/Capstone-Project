import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import {
  createMountain,
  createTrail,
  listMountains,
  listTrails,
} from "./lgu.controller";

const router = Router();

router.get("/mountains", authenticateToken, requireRole(["lgu_official"]), listMountains);
router.post("/mountains", authenticateToken, requireRole(["lgu_official"]), createMountain);
router.get("/trails", authenticateToken, requireRole(["lgu_official"]), listTrails);
router.post("/trails", authenticateToken, requireRole(["lgu_official"]), createTrail);

export default router;
