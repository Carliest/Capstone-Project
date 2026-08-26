import { Pressable, StyleSheet, Text, View } from "react-native";

const navigationTabs = ["Stream", "Requirements", "Trail", "People"] as const;
export type NavigationTab = (typeof navigationTabs)[number];

type EventNavigationTabsSectionProps = {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
};

export function EventNavigationTabsSection({
  activeTab,
  onTabChange,
}: EventNavigationTabsSectionProps) {

  return (
    <View style={styles.container}>
      {navigationTabs.map((tab) => {
        const isActive = activeTab === tab;

        return (
          <Pressable
            key={tab}
            onPress={() => onTabChange(tab)}
            style={({ pressed }) => [
              styles.tab,
              isActive ? styles.tabActive : styles.tabIdle,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.text, isActive ? styles.textActive : styles.textIdle]}>
              {tab}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(44,80,40,0.12)",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: "#e7f2e8",
    borderColor: "rgba(47,111,50,0.18)",
  },
  tabIdle: {
    backgroundColor: "#faf8f2",
    borderColor: "rgba(44,80,40,0.08)",
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
  },
  textActive: {
    color: "#2f6f32",
  },
  textIdle: {
    color: "#6b7a68",
  },
  pressed: {
    opacity: 0.88,
  },
});
