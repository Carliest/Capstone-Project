import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

type EventStreamCardProps = {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  ariaLabel?: string;
  button?: boolean;
};

export function EventStreamCard({
  children,
  onClick,
  ariaLabel,
  button = false,
}: EventStreamCardProps) {
  if (button) {
    return (
      <Pressable
        onPress={onClick}
        accessibilityRole="button"
        accessibilityLabel={ariaLabel}
        style={({ pressed }) => [styles.card, styles.pressable, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View accessibilityLabel={ariaLabel} style={styles.card}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.12)",
    backgroundColor: "#ffffff",
  },
  pressable: {
    alignSelf: "stretch",
  },
  pressed: {
    opacity: 0.92,
  },
});
