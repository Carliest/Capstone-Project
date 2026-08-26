import { ChevronRight, Backpack } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import { EventStreamCard } from "./EventStreamCard";
import { EventStreamIcon } from "./EventStreamIcon";

const items = ["Water bladder", "Headlamp", "Rain jacket", "Trail snacks"];

export function OfficialPackListSection() {
  return (
    <EventStreamCard button ariaLabel="Open official pack list" onClick={() => undefined}>
      <View style={styles.card}>
        <EventStreamIcon color="green">
          <Backpack size={16} color="#2f6f32" strokeWidth={2.2} />
        </EventStreamIcon>

        <View style={styles.content}>
          <Text style={styles.title}>Official pack list</Text>
          <View style={styles.list}>
            {items.map((item) => (
              <Text key={item} style={styles.item}>
                {"•"} {item}
              </Text>
            ))}
          </View>
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
    gap: 6,
  },
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  list: {
    gap: 6,
  },
  item: {
    color: "#4f5f4c",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "700",
  },
});
