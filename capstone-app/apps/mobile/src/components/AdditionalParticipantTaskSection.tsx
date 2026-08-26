import { Users } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

export function AdditionalParticipantTaskSection() {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Users size={16} color="#2f6f32" strokeWidth={2.2} />
        </View>
        <Text style={styles.title}>Additional participant tasks</Text>
      </View>
      <Text style={styles.body}>
        Coordinate with your group, confirm attendance, and keep your registration profile updated.
      </Text>
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
    gap: 8,
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
  body: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
});
