import { ChevronRight, HeartPulse } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EventStreamCard } from "./EventStreamCard";
import { EventStreamIcon } from "./EventStreamIcon";

export function FitnessReadinessQuestionnaireSection() {
  return (
    <EventStreamCard
      button
      ariaLabel="View completed Physical Fitness Readiness Questionnaire"
      onClick={() => undefined}
    >
      <View style={styles.card}>
        <EventStreamIcon color="orange">
          <HeartPulse size={16} color="#c8892a" strokeWidth={2.2} />
        </EventStreamIcon>

        <View style={styles.content}>
          <Text style={[styles.title, styles.struck]}>
            Physical Fitness Readiness Questionnaire
          </Text>
          <Text style={styles.body}>
            Quick self-check before summit day. Tap the option that best matches your current
            state.
          </Text>

          <View style={styles.options}>
            <Option label="Ready" active />
            <Option label="Need review" />
            <Option label="Follow-up" />
          </View>
        </View>

        <ChevronRight size={16} color="#7a9477" strokeWidth={2.2} />
      </View>
    </EventStreamCard>
  );
}

function Option({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <Pressable style={[styles.option, active ? styles.optionActive : styles.optionIdle]}>
      <Text style={[styles.optionText, active ? styles.optionTextActive : styles.optionTextIdle]}>
        {label}
      </Text>
    </Pressable>
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
    gap: 8,
  },
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  struck: {
    textDecorationLine: "line-through",
    opacity: 0.7,
  },
  body: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  options: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  option: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  optionActive: {
    backgroundColor: "#2f6f32",
    borderColor: "#2f6f32",
  },
  optionIdle: {
    backgroundColor: "#faf8f2",
    borderColor: "rgba(44,80,40,0.08)",
  },
  optionText: {
    fontSize: 12,
    fontWeight: "800",
  },
  optionTextActive: {
    color: "#ffffff",
  },
  optionTextIdle: {
    color: "#4f5f4c",
  },
});
