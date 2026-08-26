import { ChevronRight, Trees } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EventStreamCard } from "./EventStreamCard";
import { EventStreamIcon } from "./EventStreamIcon";

export function LeaveNoTraceOrientationSection() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <EventStreamCard
      button
      ariaLabel="Open Leave No Trace orientation"
      onClick={() => setIsExpanded((value) => !value)}
    >
      <View style={styles.card}>
        <EventStreamIcon color="green">
          <Trees size={16} color="#2f6f32" strokeWidth={2.2} />
        </EventStreamIcon>

        <View style={styles.content}>
          <Text style={styles.title}>Leave No Trace orientation</Text>
          <Text style={styles.body} numberOfLines={isExpanded ? 4 : 2}>
            Pack out all waste, stay on the trail, and respect the mountain community that makes
            this expedition possible.
          </Text>
        </View>

        <ChevronRight
          size={16}
          color="#7a9477"
          strokeWidth={2.2}
          style={isExpanded ? styles.rotated : undefined}
        />
      </View>
    </EventStreamCard>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  body: {
    color: "#5f6f5c",
    fontSize: 12,
    lineHeight: 18,
  },
  rotated: {
    transform: [{ rotate: "90deg" }],
  },
});
