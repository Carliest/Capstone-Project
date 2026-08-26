import { ChevronRight, ClipboardCheck } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { EventStreamCard } from "./EventStreamCard";
import { EventStreamIcon } from "./EventStreamIcon";

export function EventPreparationTaskSection() {
  return (
    <EventStreamCard
      button
      ariaLabel="Open event preparation details"
      onClick={() => undefined}
    >
      <View style={styles.card}>
        <EventStreamIcon color="blue">
          <ClipboardCheck size={16} color="#1a5276" strokeWidth={2.2} />
        </EventStreamIcon>

        <View style={styles.content}>
          <Text style={styles.title}>Event preparation</Text>
          <Text style={styles.body}>
            Double-check permits, bag weight, and emergency contacts before the final briefing.
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
