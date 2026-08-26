import { AlertTriangle } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";

type PendingTasksAlertSectionProps = {
  pendingCount?: number;
};

export function PendingTasksAlertSection({
  pendingCount = 4,
}: PendingTasksAlertSectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <AlertTriangle size={18} color="#a84d17" strokeWidth={2.2} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{pendingCount} tasks pending</Text>
        <Text style={styles.subtitle}>
          Complete the required items below to stay active in the expedition stream.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: "#fff3dd",
    borderWidth: 1,
    borderColor: "rgba(168,77,23,0.12)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,77,23,0.12)",
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#6a3b17",
    fontSize: 14,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 2,
    color: "#8a603f",
    fontSize: 12,
    lineHeight: 18,
  },
});
