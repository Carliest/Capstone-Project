import "dotenv/config";
import express from "express";
import cors from "cors";
import { pingDatabase } from "./db";
import { connectRedis } from "./redis";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "backend-api" });
});

app.get("/api/health/db", async (req, res) => {
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
});
