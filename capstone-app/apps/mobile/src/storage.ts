import * as SecureStore from "expo-secure-store";

export const SESSION_STORAGE_KEY = "capstone.mobile.session";
export const API_BASE_URL_STORAGE_KEY = "capstone.mobile.apiBaseUrl";

export async function readStoredValue(key: string) {
  return SecureStore.getItemAsync(key);
}

export async function writeStoredValue(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

export async function deleteStoredValue(key: string) {
  await SecureStore.deleteItemAsync(key);
}
