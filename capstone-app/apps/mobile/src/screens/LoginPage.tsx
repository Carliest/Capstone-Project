import { useState, type ReactNode } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
import { loginPageStyles as styles } from "./LoginPage.styles";

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
