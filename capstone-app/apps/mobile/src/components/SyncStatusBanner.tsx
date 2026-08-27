import { CloudOff, RefreshCw, Wifi, WifiOff } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

type SyncStatusBannerProps = {
  title: string;
  isOnline: boolean;
  isChecking: boolean;
  isSyncing: boolean;
  lastSyncedAt: number | null;
};

export function SyncStatusBanner({
  title,
  isOnline,
  isChecking,
  isSyncing,
  lastSyncedAt,
}: SyncStatusBannerProps) {
  const icon = isSyncing ? (
    <RefreshCw size={16} color="#1f4e22" strokeWidth={2.2} />
  ) : isOnline ? (
    <Wifi size={16} color="#1f4e22" strokeWidth={2.2} />
  ) : (
    <WifiOff size={16} color="#6a3b17" strokeWidth={2.2} />
  );

  const headline = isSyncing
    ? `Syncing ${title.toLowerCase()}`
    : isChecking
      ? "Checking connection"
      : isOnline
        ? "Online"
        : "Offline";

  const body = isSyncing
    ? "Pulling the latest data from the backend and saving it to SQLite."
    : isOnline
      ? lastSyncedAt
        ? `Last successful sync ${formatRelativeTime(lastSyncedAt)}.`
        : "Connected to the backend and ready to sync."
      : lastSyncedAt
        ? `Using cached SQLite data from ${formatRelativeTime(lastSyncedAt)}.`
        : "No cached sync data is available yet.";

  return (
    <View style={[styles.card, isOnline ? styles.onlineCard : styles.offlineCard]}>
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{headline}</Text>
        <Text style={styles.subtitle}>{body}</Text>
      </View>
      <View style={styles.badge}>
        <CloudOff size={12} color={isOnline ? "#1f4e22" : "#6a3b17"} strokeWidth={2.4} />
      </View>
    </View>
  );
}

function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return "just now";
  }

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  onlineCard: {
    backgroundColor: "#eef8ef",
    borderColor: "rgba(47,111,50,0.14)",
  },
  offlineCard: {
    backgroundColor: "#fff3dd",
    borderColor: "rgba(168,77,23,0.12)",
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(47,111,50,0.12)",
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 2,
    color: "#6e7d69",
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.7)",
  },
});
