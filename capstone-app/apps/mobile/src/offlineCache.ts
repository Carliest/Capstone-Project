import { Platform } from "react-native";
import * as webCache from "./offlineCache.web";

async function loadNativeCache() {
  return import("./offlineCache.native");
}

export async function setCachedValue<T>(key: string, value: T) {
  if (Platform.OS === "web") {
    await webCache.setCachedValue(key, value);
    return;
  }

  const nativeCache = await loadNativeCache();
  await nativeCache.setCachedValue(key, value);
}

export async function getCachedValue<T>(key: string) {
  if (Platform.OS === "web") {
    return webCache.getCachedValue<T>(key);
  }

  const nativeCache = await loadNativeCache();
  return nativeCache.getCachedValue<T>(key);
}

export async function getCachedTimestamp(key: string) {
  if (Platform.OS === "web") {
    return webCache.getCachedTimestamp(key);
  }

  const nativeCache = await loadNativeCache();
  return nativeCache.getCachedTimestamp(key);
}

export async function deleteCachedValue(key: string) {
  if (Platform.OS === "web") {
    await webCache.deleteCachedValue(key);
    return;
  }

  const nativeCache = await loadNativeCache();
  await nativeCache.deleteCachedValue(key);
}
