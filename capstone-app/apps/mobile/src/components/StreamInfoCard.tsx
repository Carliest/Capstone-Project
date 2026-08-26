import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

type StreamInfoCardProps = {
  title: string;
  body: string;
  accent?: string;
  icon: ReactNode;
};

export function StreamInfoCard({
  title,
  body,
  accent = "#2f6f32",
  icon,
}: StreamInfoCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${accent}1a` }]}>
        {icon}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#ffffff",
    padding: 14,
    flexDirection: "row",
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
    marginTop: 2,
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
});
