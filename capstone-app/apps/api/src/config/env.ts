const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 5000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  qrHmacSecret: process.env.QR_HMAC_SECRET ?? "",
  openWeatherApiKey: process.env.OPENWEATHER_API_KEY ?? "",
  mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN ?? "",
};

export const isProduction = env.nodeEnv === "production";
