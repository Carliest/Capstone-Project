import { Router } from "express";
import { authenticateToken } from "../../middlewares/auth.middleware";
import { createAnnouncement, listAnnouncements } from "./announcement.controller";

const router = Router();

router.get("/", listAnnouncements);
router.post("/", authenticateToken, createAnnouncement);

export default router;
