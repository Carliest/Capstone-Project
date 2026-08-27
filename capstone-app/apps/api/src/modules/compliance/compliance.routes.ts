import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import {
  createDocumentType,
  listDocumentTypes,
  uploadComplianceDocument,
  verifyComplianceDocument,
} from "./compliance.controller";

const router = Router();

router.get("/document-types", authenticateToken, requireRole(["organizer"]), listDocumentTypes);
router.post("/document-types", authenticateToken, requireRole(["organizer"]), createDocumentType);
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
