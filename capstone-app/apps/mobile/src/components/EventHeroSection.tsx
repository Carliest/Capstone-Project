import { ArrowLeft, CalendarDays, MapPin, Mountain, Users } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { JoinedGroup } from "../types/manifest";

type EventHeroSectionProps = {
  manifest: JoinedGroup | null;
  onBack: () => void;
};

export function EventHeroSection({ manifest, onBack }: EventHeroSectionProps) {
  return (
    <View style={styles.hero}>
      <View style={styles.backRow}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={16} color="#ffffff" strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.backLabel}>Back to groups</Text>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Mountain size={32} color="#edf5e8" strokeWidth={2.1} />
        </View>

        <Text style={styles.kicker}>Kaibigan ng Kalikasan</Text>
        <Text style={styles.title} numberOfLines={2}>
          {manifest?.trail_name ?? "Isarog Summit Assault 2026"}
        </Text>

        <View style={styles.metaRow}>
          <MetaItem icon={<MapPin size={12} color="#dfead9" />} label={manifest?.mountain_name ?? "Mt. Isarog"} />
          <MetaItem icon={<CalendarDays size={12} color="#dfead9" />} label={formatDate(manifest?.climb_date)} />
          <MetaItem
            icon={<Users size={12} color="#dfead9" />}
            label={formatSlots(manifest?.current_trail_occupancy, manifest?.daily_carrying_capacity)}
          />
        </View>
      </View>
    </View>
  );
}

function MetaItem({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <View style={styles.metaItem}>
      {icon}
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function formatDate(dateValue: string | null | undefined) {
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

function formatSlots(usedValue: number | null | undefined, totalValue: number | null | undefined) {
  const used = usedValue ?? 0;
  const total = totalValue ?? 0;
  return total > 0 ? `${used}/${total}` : `${used}/--`;
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 178,
    backgroundColor: "#1f4e22",
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 16,
    justifyContent: "space-between",
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  backLabel: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  heroCard: {
    gap: 6,
  },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kicker: {
    color: "#d7e4d0",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: {
    color: "#edf5e8",
    fontSize: 11,
    fontWeight: "700",
    maxWidth: 100,
  },
  pressed: {
    opacity: 0.84,
  },
});
