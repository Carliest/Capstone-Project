import { ChevronRight } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { EventStreamCard } from "./EventStreamCard";
import { EventStreamIcon } from "./EventStreamIcon";

export function EventStreamContinuationSection() {
  return (
    <EventStreamCard
      button
      ariaLabel="Open stream continuation"
      onClick={() => undefined}
    >
      <View style={styles.card}>
        <EventStreamIcon color="orange">
          <ChevronRight size={18} color="#c8892a" strokeWidth={2.2} />
        </EventStreamIcon>
        <View style={styles.content}>
          <Text style={styles.title}>Stream continues</Text>
          <Text style={styles.body}>
            More guide announcements and readiness checks will appear here as summit day approaches.
          </Text>
        </View>
        <ChevronRight size={16} color="#7a9477" strokeWidth={2.2} />
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
  },
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  body: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
});
