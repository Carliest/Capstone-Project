import { Router } from "express";
import { authenticateToken, requireRole } from "../../middlewares/auth.middleware";
import { issuePermit } from "./permit.controller";

const router = Router();

router.post("/issue", authenticateToken, requireRole(["lgu_official"]), issuePermit);

export default router;
