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

export async function setCachedValue<T>(key: string, value: T) {
  setWebStorageItem(
    key,
    JSON.stringify({
      payload: value,
      updated_at: Date.now(),
    })
  );
}

export async function getCachedValue<T>(key: string) {
  const stored = getWebStorageItem(key);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as { payload: T };
    return parsed.payload ?? null;
  } catch {
    return null;
  }
}

export async function getCachedTimestamp(key: string) {
  const stored = getWebStorageItem(key);
  if (!stored) {
    return null;
  }

  try {
    const parsed = JSON.parse(stored) as { updated_at?: number };
    return typeof parsed.updated_at === "number" ? parsed.updated_at : null;
  } catch {
    return null;
  }
}

export async function deleteCachedValue(key: string) {
  removeWebStorageItem(key);
}
