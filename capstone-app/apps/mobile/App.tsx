import { useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, View } from "react-native";
import { GroupsPage } from "./src/screens/GroupsPage";
import { LoginPage } from "./src/screens/LoginPage";
import { HikerRegistrationScreen } from "./src/screens/HikerRegistration";
import { LandingPage } from "./src/screens/LandingPage";
import { GroupPageStream } from "./src/screens/GroupPageStream";
import type { JoinedGroup } from "./src/types/manifest";

type ScreenKey = "landing" | "login" | "groups" | "hikerRegistration" | "groupStream";

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
            onCompleted={(summary) => {
              setLastAction(summary);
              setScreen(summary === "Logged In" ? "groups" : "landing");
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
