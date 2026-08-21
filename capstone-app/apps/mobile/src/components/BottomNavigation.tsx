import type { ComponentType } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type BottomNavigationItem = {
  label: string;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  active: boolean;
  onPress: () => void;
};

type BottomNavigationProps = {
  items: BottomNavigationItem[];
};

export function BottomNavigation({ items }: BottomNavigationProps) {
  return (
    <View style={styles.navBar}>
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            style={styles.navItem}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: item.active }}
          >
            <Icon
              size={22}
              strokeWidth={1.8}
              color={item.active ? "#2e6a33" : "#8e9b8a"}
            />
            <Text style={[styles.navLabel, item.active && styles.navLabelActive]}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderTopColor: "#e8e4db",
    backgroundColor: "#ffffff",
    paddingTop: 14,
    paddingBottom: 18,
  },
  navItem: {
    alignItems: "center",
    gap: 4,
    minWidth: 84,
  },
  navLabel: {
    color: "#8e9b8a",
    fontSize: 10,
    fontWeight: "700",
  },
  navLabelActive: {
    color: "#2e6a33",
  },
});
