import { useState, type ReactNode } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { createApiClient } from "../api";
import {
  SESSION_STORAGE_KEY,
  writeStoredValue,
} from "../storage";

type LoginPageProps = {
  onBack: () => void;
  onSignUp: () => void;
  onCompleted: (summary: string) => void;
};

type LoginResponse = {
  user: {
    user_id: string;
    email: string;
    role: string;
    first_name: string;
    last_name: string;
    address: string;
    profile_picture: string | null;
  };
  token: string;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
const apiClient = apiBaseUrl ? createApiClient(apiBaseUrl) : null;

export function LoginPage({
  onBack,
  onSignUp,
  onCompleted,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setStatusMessage("Please enter your email address and password.");
      return;
    }

    if (!apiClient) {
      Alert.alert(
        "API not configured",
        "Set EXPO_PUBLIC_API_URL to your Render backend URL before logging in."
      );
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const result = await apiClient.post<LoginResponse>("/api/auth/login", {
        email: email.trim(),
        password,
      });

      await writeStoredValue(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          token: result.token,
          user: result.user,
        })
      );

      onCompleted("Logged In");
      Alert.alert("Welcome back", "You are now signed in.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log in right now.";
      setStatusMessage(message);
      Alert.alert("Login failed", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.screen}>
          <View style={styles.backdropTop} />
          <View style={styles.backdropBottom} />

          <View style={styles.surface}>
            <Pressable
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
              onPress={onBack}
            >
              <Text
                style={styles.backArrow}
                accessibilityElementsHidden={true}
              >
                {"<-"}
              </Text>
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <View style={styles.header}>
              <Text style={styles.kicker}>EcoTrail Bicol</Text>
              <Text style={styles.title} accessibilityRole="header">
                Welcome back!
              </Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.form}>
              <LoginField
                id="login-email"
                label="Email Address"
                value={email}
                placeholder="your@email.com"
                keyboardType="email-address"
                autoComplete="email"
                onChangeText={(value) => {
                  setEmail(value);
                  setStatusMessage("");
                }}
                icon="@" 
              />

              <LoginField
                id="login-password"
                label="Password"
                value={password}
                placeholder="••••••••"
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                onChangeText={(value) => {
                  setPassword(value);
                  setStatusMessage("");
                }}
                icon="◌"
                endAdornment={
                  <Pressable
                    onPress={() => setShowPassword((current) => !current)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    style={({ pressed }) => [
                      styles.passwordToggle,
                      pressed && styles.passwordTogglePressed,
                    ]}
                  >
                    <Text style={styles.passwordToggleText}>
                      {showPassword ? "Hide" : "Show"}
                    </Text>
                  </Pressable>
                }
              />
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || isSubmitting) && styles.submitButtonPressed,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Signing In..." : "Log In"}
              </Text>
            </Pressable>

            <View style={styles.footerRow}>
              <Text style={styles.footerText}>
                No account?{" "}
                <Text style={styles.footerLink} onPress={onSignUp}>
                  Sign up
                </Text>
              </Text>
              <Pressable
                onPress={() =>
                  Alert.alert(
                    "Password recovery",
                    "Password recovery is not available yet."
                  )
                }
                accessibilityRole="button"
              >
                <Text style={styles.recoveryLink}>Forgot password?</Text>
              </Pressable>
            </View>

            <Text style={styles.statusText} accessibilityLiveRegion="polite">
              {statusMessage}
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LoginField(props: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoComplete?: NonNullable<TextInputProps["autoComplete"]>;
  keyboardType?: NonNullable<TextInputProps["keyboardType"]>;
  secureTextEntry?: boolean;
  icon: string;
  endAdornment?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <View style={styles.fieldShell}>
        <View
          style={styles.fieldIcon}
          accessibilityElementsHidden={true}
        >
          <Text style={styles.fieldIconText}>{props.icon}</Text>
        </View>
        <TextInput
          nativeID={props.id}
          style={styles.input}
          placeholder={props.placeholder}
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={props.value}
          autoComplete={props.autoComplete}
          autoCapitalize={
            props.autoComplete === "email" ||
            props.autoComplete === "current-password"
              ? "none"
              : "words"
          }
          keyboardType={props.keyboardType ?? "default"}
          secureTextEntry={props.secureTextEntry}
          onChangeText={props.onChangeText}
        />
        {props.endAdornment ? (
          <View style={styles.endAdornment}>{props.endAdornment}</View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#070e08",
  },
  screen: {
    minHeight: "100%",
    padding: 24,
    backgroundColor: "#0d2010",
    justifyContent: "center",
  },
  backdropTop: {
    position: "absolute",
    top: -100,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(96, 215, 100, 0.16)",
  },
  backdropBottom: {
    position: "absolute",
    bottom: -110,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(74, 158, 77, 0.16)",
  },
  surface: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(10, 23, 16, 0.94)",
    padding: 22,
    gap: 18,
  },
  backButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  backButtonPressed: {
    opacity: 0.8,
  },
  backArrow: {
    color: "#ffffffcc",
    fontSize: 18,
    fontWeight: "700",
  },
  backText: {
    color: "#ffffff99",
    fontSize: 14,
    fontWeight: "600",
  },
  header: {
    gap: 4,
  },
  kicker: {
    color: "#4a9e4d",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "900",
    letterSpacing: -1,
  },
  subtitle: {
    color: "#ffffff80",
    fontSize: 14,
    lineHeight: 20,
  },
  form: {
    gap: 14,
    paddingTop: 8,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: "#ffffffb2",
    fontSize: 12,
    fontWeight: "600",
  },
  fieldShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 14,
    minHeight: 54,
  },
  fieldIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(74, 158, 77, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(96, 215, 100, 0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldIconText: {
    color: "#e4ebe0",
    fontSize: 12,
    fontWeight: "800",
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 0,
  },
  endAdornment: {
    justifyContent: "center",
  },
  passwordToggle: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  passwordTogglePressed: {
    opacity: 0.75,
  },
  passwordToggleText: {
    color: "#ffffffb8",
    fontSize: 12,
    fontWeight: "700",
  },
  submitButton: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  submitButtonPressed: {
    opacity: 0.9,
  },
  submitButtonText: {
    color: "#1c3a1e",
    fontSize: 14,
    fontWeight: "800",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  footerText: {
    flexShrink: 1,
    color: "#ffffff80",
    fontSize: 14,
    lineHeight: 20,
  },
  footerLink: {
    color: "#ffffff",
    fontWeight: "800",
  },
  recoveryLink: {
    color: "#8fb7ff",
    fontSize: 14,
    fontWeight: "700",
  },
  statusText: {
    color: "#b8d5b8",
    fontSize: 12,
    lineHeight: 18,
    minHeight: 18,
  },
});
