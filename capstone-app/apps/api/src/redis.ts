import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

export const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
    })
  : null;

if (redisClient) {
  redisClient.on("error", (error) => {
    console.error("Redis client error:", error);
  });
}

export async function connectRedis() {
  if (!redisClient) {
    return null;
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  return redisClient.ping();
}
