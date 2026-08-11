import { Router } from "express";
import { createLguAccount, updateLguCredentials } from "./admin.controller";
import { requireSuperAdminKey } from "../../middlewares/superAdmin.middleware";

const router = Router();

router.post("/lgu-accounts", requireSuperAdminKey, createLguAccount);
router.patch("/lgu-accounts/:lguId/credentials", requireSuperAdminKey, updateLguCredentials);

export default router;
