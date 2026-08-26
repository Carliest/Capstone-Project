import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  CalendarDays,
  FileText,
  MapPin,
  Mountain,
  Users,
} from "lucide-react-native";

type ManifestCardData = {
  manifest_id: string;
  trail_name: string | null;
  organizer_name: string | null;
  mountain_name: string | null;
  climb_date: string | null;
  current_trail_occupancy: number | null;
  daily_carrying_capacity: number | null;
  guide_name: string | null;
  location_description?: string | null;
  joined_count?: number;
};

type ManifestCardProps = {
  manifest: ManifestCardData;
  description: string;
  onViewStream?: () => void;
  onPress?: () => void;
};

export function ManifestCard({
  manifest,
  description,
  onViewStream,
  onPress,
}: ManifestCardProps) {
  const percent = getOccupancyPercent(manifest);

  return (
    <Pressable
      onPress={onPress ?? onViewStream}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.hero}>
        <View style={styles.heroOverlay} />
        <View style={styles.heroBadge}>
          <Mountain size={34} strokeWidth={2.1} color="#e8f1e4" />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.statusPill}>Upcoming</Text>
          <Text style={styles.title} numberOfLines={1}>
            {manifest.trail_name ?? "Expedition Manifest"}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {manifest.organizer_name ?? "Kaibigan ng Kalikasan"}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>

        <View style={styles.detailRow}>
          <DetailBlock
            icon={<MapPin size={14} strokeWidth={2} color="#2f6f32" />}
            label="Mountain"
            value={manifest.mountain_name ?? "Unknown"}
          />
          <DetailBlock
            icon={<CalendarDays size={14} strokeWidth={2} color="#2f6f32" />}
            label="Date"
            value={formatPreviewDate(manifest.climb_date)}
          />
          <DetailBlock
            icon={<Users size={14} strokeWidth={2} color="#2f6f32" />}
            label="Slots"
            value={formatSlots(manifest)}
          />
        </View>

        <View style={styles.footer}>
          <Text style={styles.guideText}>
            Guide: {manifest.guide_name ?? "Pending assignment"}
          </Text>
          <Pressable
            onPress={onViewStream}
            style={({ pressed }) => [styles.streamButton, pressed && styles.pressed]}
          >
            <FileText size={14} strokeWidth={2} color="#2f6f32" />
            <Text style={styles.streamText}>View stream</Text>
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${percent}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

function DetailBlock({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailBlock}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function formatPreviewDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "Jun 21, 2026";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Jun 21, 2026";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatSlots(manifest: ManifestCardData) {
  const used = manifest.current_trail_occupancy ?? manifest.joined_count ?? 0;
  const total = manifest.daily_carrying_capacity ?? 0;

  if (!total) {
    return `${used}/--`;
  }

  return `${used}/${total}`;
}

function getOccupancyPercent(manifest: ManifestCardData) {
  const used = manifest.current_trail_occupancy ?? manifest.joined_count ?? 0;
  const total = manifest.daily_carrying_capacity ?? 0;

  if (!total) {
    return 26;
  }

  return Math.min(100, Math.max(12, Math.round((used / total) * 100)));
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  hero: {
    minHeight: 116,
    padding: 14,
    backgroundColor: "#2f6f32",
    justifyContent: "flex-end",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(31, 78, 34, 0.52)",
  },
  heroBadge: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 10,
  },
  heroText: {
    gap: 3,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#f2f7ee",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  title: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  subtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 12,
    lineHeight: 16,
  },
  body: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  description: {
    color: "#6e7d69",
    fontSize: 13,
    lineHeight: 18,
  },
  detailRow: {
    flexDirection: "row",
    gap: 8,
  },
  detailBlock: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#faf8f2",
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e7f2e8",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: "#7a9477",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: "#243524",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  guideText: {
    color: "#4f5f4c",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  streamButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  streamText: {
    color: "#2f6f32",
    fontSize: 11,
    fontWeight: "800",
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: "#e8e4db",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2f6f32",
  },
});
