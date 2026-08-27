import { useEffect, useState } from "react";
import { normalizeApiBaseUrl } from "../api";

type BackendSyncStatus = {
  isChecking: boolean;
  isOnline: boolean;
  lastCheckedAt: number | null;
  refresh: () => Promise<void>;
};

const HEALTH_CHECK_TIMEOUT_MS = 4000;
const HEALTH_CHECK_INTERVAL_MS = 15000;

export function useBackendSyncStatus(apiBaseUrl: string): BackendSyncStatus {
  const normalizedBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  async function refresh() {
    if (!normalizedBaseUrl) {
      setIsOnline(false);
      setLastCheckedAt(Date.now());
      return;
    }

    setIsChecking(true);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
      const response = await fetch(`${normalizedBaseUrl}/api/health`, {
        signal: controller.signal,
      });
      setIsOnline(response.ok);
      setLastCheckedAt(Date.now());
    } catch {
      setIsOnline(false);
      setLastCheckedAt(Date.now());
    } finally {
      clearTimeout(timeout);
      setIsChecking(false);
    }
  }

  useEffect(() => {
    void refresh();

    const intervalId = setInterval(() => {
      void refresh();
    }, HEALTH_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [normalizedBaseUrl]);

  return {
    isChecking,
    isOnline,
    lastCheckedAt,
    refresh,
  };
}
