import { AlertTriangle, ShieldAlert } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

export function EmergencyActionsSection() {
  return (
    <View style={styles.row}>
      <Pressable style={({ pressed }) => [styles.hazardButton, pressed && styles.pressed]}>
        <AlertTriangle size={16} color="#c0392b" strokeWidth={2.2} />
        <Text style={styles.hazardText}>Report Hazard</Text>
      </Pressable>

      <Pressable style={({ pressed }) => [styles.sosButton, pressed && styles.pressed]}>
        <ShieldAlert size={16} color="#ffffff" strokeWidth={2.2} />
        <Text style={styles.sosText}>SOS Emergency</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  hazardButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e57373",
    backgroundColor: "#fce4ec",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  hazardText: {
    color: "#c0392b",
    fontSize: 13,
    fontWeight: "800",
  },
  sosButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: "#c0392b",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  sosText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.9,
  },
});
