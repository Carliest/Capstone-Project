import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

type EventStreamIconProps = {
  children: ReactNode;
  color: "green" | "blue" | "orange" | "neutral";
};

const colors = {
  green: "#e8f5e9",
  blue: "#e3f2fd",
  orange: "#fff3e0",
  neutral: "#f1f3ef",
};

export function EventStreamIcon({ children, color }: EventStreamIconProps) {
  return <View style={[styles.icon, { backgroundColor: colors[color] }]}>{children}</View>;
}

const styles = StyleSheet.create({
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
