import cors from "cors";
import express from "express";
import { pingDatabase } from "./config/database";
import { connectRedis } from "./redis";
import { searchPlace } from "./mapbox";
import { getCurrentWeather } from "./weather";
import authRoutes from "./modules/auth/auth.routes";
import manifestRoutes from "./modules/manifests/manifest.routes";
import complianceRoutes from "./modules/compliance/compliance.routes";
import permitRoutes from "./modules/permits/permit.routes";
import trackingRoutes from "./modules/tracking/tracking.routes";
import announcementRoutes from "./modules/announcements/announcement.routes";
import adminRoutes from "./modules/admin/admin.routes";
import lguRoutes from "./modules/lgu/lgu.routes";
import { errorMiddleware } from "./middlewares/error.middleware";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "backend-api" });
});

app.get("/api/health/db", async (_req, res) => {
  try {
    const [database, redis] = await Promise.all([
      pingDatabase(),
      connectRedis(),
    ]);

    res.json({
      status: "ok",
      database: database ? "connected" : "not_configured",
      redis: redis ? "connected" : "not_configured",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/weather/current", async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({
        status: "error",
        message: "lat and lon query parameters are required",
      });
    }

    const weather = await getCurrentWeather(lat, lon);

    if (!weather) {
      return res.status(503).json({
        status: "error",
        message: "OPENWEATHER_API_KEY is not configured",
      });
    }

    return res.json({
      status: "ok",
      weather,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.get("/api/mapbox/health", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" && req.query.q.trim()
      ? req.query.q.trim()
      : "Perth";

    const result = await searchPlace(query);

    if (!result) {
      return res.status(503).json({
        status: "error",
        message: "MAPBOX_ACCESS_TOKEN is not configured",
      });
    }

    return res.json({
      status: "ok",
      mapbox: result,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/lgu", lguRoutes);
app.use("/api/manifests", manifestRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/permits", permitRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/announcements", announcementRoutes);

app.use(errorMiddleware);
