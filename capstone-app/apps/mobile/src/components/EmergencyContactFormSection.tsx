import { Phone, UserRound } from "lucide-react-native";
import type { ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

export function EmergencyContactFormSection() {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Emergency contact</Text>
      <Text style={styles.subtitle}>Keep one trusted person ready if conditions change.</Text>

      <Field icon={<UserRound size={14} color="#7a9477" strokeWidth={2.2} />} placeholder="Contact name" />
      <Field icon={<Phone size={14} color="#7a9477" strokeWidth={2.2} />} placeholder="+63 9XX XXX XXXX" />
    </View>
  );
}

function Field({ icon, placeholder }: { icon: ReactNode; placeholder: string }) {
  return (
    <View style={styles.field}>
      {icon}
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#97a38f"
        style={styles.input}
      />
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
  title: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  subtitle: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  field: {
    minHeight: 46,
    borderRadius: 16,
    backgroundColor: "#faf8f2",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: "#243524",
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 0,
  },
});
