import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { createApiClient } from "../api";
import { hikerRegistrationStyles as styles } from "./HikerRegistration.styles";

type HikerRegistrationScreenProps = {
  onBack: () => void;
  onCompleted: (summary: string) => void;
};

type RegistrationForm = {
  fullName: string;
  email: string;
  password: string;
  city: string;
  emergencyName: string;
  emergencyNumber: string;
  profilePicture: string | null;
};

const initialRegistrationForm: RegistrationForm = {
  fullName: "",
  email: "",
  password: "",
  city: "",
  emergencyName: "",
  emergencyNumber: "",
  profilePicture: null,
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
const apiClient = apiBaseUrl ? createApiClient(apiBaseUrl) : null;

export function HikerRegistrationScreen({
  onBack,
  onCompleted,
}: HikerRegistrationScreenProps) {
  const [form, setForm] = useState<RegistrationForm>(initialRegistrationForm);
  const [showPassword, setShowPassword] = useState(false);
  const [isPickingPhoto, setIsPickingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const avatarLabel = useMemo(() => {
    const parts = form.fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return "HP";
    }

    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
  }, [form.fullName]);

  function handleChange<K extends keyof RegistrationForm>(
    field: K,
    value: RegistrationForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handlePickPhoto() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission required",
          "Please allow photo access so you can choose a profile picture."
        );
        return;
      }

      setIsPickingPhoto(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.75,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        Alert.alert(
          "Image unavailable",
          "We couldn't read the selected image. Please choose another photo."
        );
        return;
      }

      const mimeType = asset.mimeType ?? "image/jpeg";
      const dataUri = `data:${mimeType};base64,${asset.base64}`;
      handleChange("profilePicture", dataUri);
    } catch (error) {
      Alert.alert(
        "Photo picker failed",
        error instanceof Error ? error.message : "Unable to open the photo picker."
      );
    } finally {
      setIsPickingPhoto(false);
    }
  }

  function splitFullName(fullName: string) {
    const trimmed = fullName.trim();
    const parts = trimmed.split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return { firstName: "", lastName: "" };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: parts[0] };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  }

  async function handleSubmit() {
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      !form.city.trim() ||
      !form.emergencyName.trim() ||
      !form.emergencyNumber.trim()
    ) {
      Alert.alert("Missing fields", "Please fill in all required details.");
      return;
    }

    if (!apiClient) {
      Alert.alert(
        "API not configured",
        "Set EXPO_PUBLIC_API_URL to your Render backend URL before registering."
      );
      return;
    }

    const { firstName, lastName } = splitFullName(form.fullName);
    if (!firstName || !lastName) {
      Alert.alert(
        "Enter your full name",
        "Please include at least a first name and last name."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post("/api/auth/register", {
        email: form.email.trim(),
        password: form.password,
        role: "hiker",
        firstName,
        lastName,
        address: form.city.trim(),
        profilePicture: form.profilePicture ?? undefined,
        profile: {
          emergencyContactName: form.emergencyName.trim(),
          emergencyContactNumber: form.emergencyNumber.trim(),
        },
      });

      Alert.alert(
        "Account created",
        "Your hiker account and profile photo were saved successfully."
      );
      onCompleted("Created Hiker Account");
      setForm(initialRegistrationForm);
      setShowPassword(false);
    } catch (error) {
      Alert.alert(
        "Registration failed",
        error instanceof Error ? error.message : "Something went wrong while creating the account."
      );
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
          <View style={styles.topGlow} />
          <View style={styles.bottomGlow} />

          <Pressable
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.82 },
            ]}
            onPress={onBack}
          >
            <Text style={styles.backButtonArrow}>{"<-"}</Text>
            <Text style={styles.backButtonText}>Back</Text>
          </Pressable>

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Hiker Registration</Text>
            <Text style={styles.headerSubtitle}>
              Fill in your details below
            </Text>
          </View>

          <View style={styles.avatarSection}>
            <Text style={styles.avatarLabel}>Profile Photo (optional)</Text>
            <View style={styles.avatarCard}>
              <View style={styles.avatarCircle}>
                {form.profilePicture ? (
                  <Image
                    source={{ uri: form.profilePicture }}
                    style={styles.avatarImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.avatarInitials}>{avatarLabel}</Text>
                )}
              </View>
              <View style={styles.avatarCopy}>
                <Text style={styles.avatarTitle}>
                  {form.profilePicture ? "Photo selected" : "Choose a profile photo"}
                </Text>
                <Text style={styles.avatarHint}>
                  {form.profilePicture
                    ? "The selected image will be saved with your account."
                    : "Use a real photo from your device. It will be stored with your registration data."}
                </Text>
              </View>
              <Pressable
                onPress={handlePickPhoto}
                disabled={isPickingPhoto}
                style={({ pressed }) => [
                  styles.photoButton,
                  (pressed || isPickingPhoto) && styles.photoButtonPressed,
                ]}
              >
                <Text style={styles.photoButtonText}>
                  {form.profilePicture
                    ? "Change Photo"
                    : isPickingPhoto
                      ? "Opening..."
                      : "Choose Photo"}
                </Text>
              </Pressable>
              {form.profilePicture ? (
                <Pressable
                  onPress={() => handleChange("profilePicture", null)}
                  style={({ pressed }) => [
                    styles.photoLinkButton,
                    pressed && styles.photoLinkButtonPressed,
                  ]}
                >
                  <Text style={styles.photoLinkText}>Remove photo</Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.formStack}>
            <RegistrationField
              label="Full Name"
              placeholder="Juan dela Cruz"
              value={form.fullName}
              autoComplete="name"
              onChangeText={(value) => handleChange("fullName", value)}
            />
            <RegistrationField
              label="Email Address"
              placeholder="your@email.com"
              value={form.email}
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={(value) => handleChange("email", value)}
            />
            <RegistrationField
              label="Password"
              placeholder="Min. 8 characters"
              value={form.password}
              autoComplete="new-password"
              secureTextEntry={!showPassword}
              onChangeText={(value) => handleChange("password", value)}
              endAdornment={
                <Pressable
                  onPress={() => setShowPassword((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Text style={styles.passwordToggleText}>
                    {showPassword ? "Hide" : "Show"}
                  </Text>
                </Pressable>
              }
            />
            <RegistrationField
              label="City / Municipality"
              placeholder="e.g. Naga City"
              value={form.city}
              autoComplete="address-line2"
              onChangeText={(value) => handleChange("city", value)}
            />
            <View style={styles.emergencyCard}>
              <Text style={styles.emergencyLabel}>Emergency Contact</Text>
              <View style={styles.formStackInner}>
                <RegistrationField
                  label="Contact Name"
                  placeholder="Full name"
                  value={form.emergencyName}
                  autoComplete="name"
                  onChangeText={(value) => handleChange("emergencyName", value)}
                />
                <RegistrationField
                  label="Contact Number"
                  placeholder="+63 9XX XXX XXXX"
                  value={form.emergencyNumber}
                  autoComplete="tel"
                  keyboardType="phone-pad"
                  onChangeText={(value) =>
                    handleChange("emergencyNumber", value)
                  }
                />
              </View>
            </View>
          </View>

          <View style={styles.submitWrap}>
            <Pressable
              onPress={handleSubmit}
              disabled={isSubmitting}
              style={({ pressed }) => [
                styles.submitButton,
                (pressed || isSubmitting) && styles.submitButtonPressed,
              ]}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Creating Account..." : "Create Account"}
              </Text>
            </Pressable>
            <Text style={styles.loginPrompt}>
              Already have an account?{" "}
              <Text
                style={styles.loginLink}
                onPress={() =>
                  Alert.alert("Log in", "Log in is not available yet.")
                }
              >
                Log in
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function RegistrationField(props: {
  label: string;
  placeholder: string;
  value: string;
  autoComplete?: NonNullable<TextInputProps["autoComplete"]>;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: NonNullable<TextInputProps["keyboardType"]>;
  endAdornment?: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={props.placeholder}
          placeholderTextColor="rgba(255,255,255,0.5)"
          value={props.value}
          autoComplete={props.autoComplete}
          autoCapitalize={
            props.autoComplete === "email" ||
            props.autoComplete === "new-password" ||
            props.autoComplete === "tel"
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
