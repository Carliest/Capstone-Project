import { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { GroupsPage } from "./src/screens/GroupsPage";
import { LoginPage } from "./src/screens/LoginPage";
import { HikerRegistrationScreen } from "./src/screens/HikerRegistration";
import { LandingPage } from "./src/screens/LandingPage";
import { GroupPageStream } from "./src/screens/GroupPageStream";
import { ManagementWorkspaceScreen } from "./src/screens/ManagementWorkspaceScreen";
import type { JoinedGroup } from "./src/types/manifest";

type ScreenKey =
  | "landing"
  | "login"
  | "groups"
  | "hikerRegistration"
  | "groupStream"
  | "organizerHub"
  | "lguHub";

type LoginResult = {
  user: {
    role: string;
  };
};

export default function App() {
  const [screen, setScreen] = useState<ScreenKey>("landing");
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [selectedManifest, setSelectedManifest] = useState<JoinedGroup | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.flex1}>
        {screen === "landing" ? (
          <LandingPage
            lastAction={lastAction}
            onCreateAccount={() => setScreen("hikerRegistration")}
            onLogIn={() => setScreen("login")}
            onHikerRegistration={() => setScreen("hikerRegistration")}
            onOrganizerSignup={() => setLastAction("Organizer Sign-up")}
          />
        ) : screen === "login" ? (
          <LoginPage
            onBack={() => setScreen("landing")}
            onSignUp={() => setScreen("hikerRegistration")}
            onCompleted={(result: LoginResult) => {
              setLastAction("Logged In");

              if (result.user.role === "organizer") {
                setScreen("organizerHub");
                return;
              }

              if (result.user.role === "lgu_official") {
                setScreen("lguHub");
                return;
              }

              setScreen("groups");
            }}
          />
        ) : screen === "groups" ? (
          <GroupsPage
            onLogout={() => {
              setLastAction("Logged out");
              setScreen("login");
            }}
            onOpenStream={(manifest) => {
              setSelectedManifest(manifest);
              setScreen("groupStream");
            }}
          />
        ) : screen === "groupStream" ? (
          <GroupPageStream
            manifest={selectedManifest}
            onBack={() => setScreen("groups")}
          />
        ) : screen === "organizerHub" ? (
          <ManagementWorkspaceScreen
            mode="organizer"
            onLogout={() => {
              setLastAction("Logged out");
              setScreen("login");
            }}
          />
        ) : screen === "lguHub" ? (
          <ManagementWorkspaceScreen
            mode="lgu_official"
            onLogout={() => {
              setLastAction("Logged out");
              setScreen("login");
            }}
          />
        ) : (
          <HikerRegistrationScreen
            onBack={() => setScreen("landing")}
            onCompleted={(summary) => {
              setLastAction(summary);
              setScreen("landing");
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070e08",
  },
  flex1: {
    flex: 1,
  },
});
