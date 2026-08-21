import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const SESSION_STORAGE_KEY = "capstone.mobile.session";
export const API_BASE_URL_STORAGE_KEY = "capstone.mobile.apiBaseUrl";

export async function readStoredValue(key: string) {
  if (Platform.OS === "web") {
    return getWebStorageItem(key);
  }

  return SecureStore.getItemAsync(key);
}

export async function writeStoredValue(key: string, value: string) {
  if (Platform.OS === "web") {
    setWebStorageItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredValue(key: string) {
  if (Platform.OS === "web") {
    removeWebStorageItem(key);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

function getWebStorageItem(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function setWebStorageItem(key: string, value: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(key, value);
}

function removeWebStorageItem(key: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(key);
}
