import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import {
  uploadComplianceDocument,
  verifyComplianceDocument,
} from "./compliance.controller";

const router = Router();

router.post(
  "/upload",
  authenticateToken,
  requireRole(["hiker"]),
  uploadComplianceDocument
);
router.patch(
  "/verify",
  authenticateToken,
  requireRole(["lgu_official"]),
  verifyComplianceDocument
);

export default router;
