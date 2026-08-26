import { BadgeCheck, FileText } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

const items = [
  "LGU-issued permit",
  "Valid government ID",
  "Medical clearance",
];

export function PermitDocumentsRequirementSection() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <FileText size={16} color="#2f6f32" strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>Permit documents required</Text>
      </View>

      <View style={styles.list}>
        {items.map((item) => (
          <View key={item} style={styles.item}>
            <BadgeCheck size={15} color="#2f6f32" strokeWidth={2.2} />
            <Text style={styles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#e7f2e8",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  list: {
    gap: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemText: {
    color: "#4f5f4c",
    fontSize: 12,
    fontWeight: "700",
  },
});
