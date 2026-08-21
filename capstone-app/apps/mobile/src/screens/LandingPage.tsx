import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

type LandingPageProps = {
  lastAction: string | null;
  onCreateAccount: () => void;
  onLogIn: () => void;
  onHikerRegistration: () => void;
  onOrganizerSignup: () => void;
};

const statistics = [
  { value: "5", label: "Mountains" },
  { value: "200+", label: "Trail km" },
  { value: "50+", label: "Guides" },
  { value: "3.4k+", label: "Hikers" },
];

const peaks = [
  {
    name: "MT. ISAROG",
    tags: ["Active Volcano", "Guided Required"],
    elevation: "1,966m",
    difficulty: "Moderate-Advanced",
    trails: "1 trail",
    accent: "#4a9e4d",
    glow: "#60d764",
  },
  {
    name: "MT. ASOG",
    tags: ["Beginner Friendly", "Lake Buhi Views"],
    elevation: "1,154m",
    difficulty: "Beginner-Moderate",
    trails: "3 trails",
    accent: "#c8892a",
    glow: "#f0b64a",
  },
];

const benefits = [
  {
    title: "Real-Time Safety",
    description: "Live hiker tracking, SOS alerts, and weather integration.",
    badge: "S",
  },
  {
    title: "Leave No Trace",
    description:
      "Every expedition follows strict LNT protocols with waste pack-out.",
    badge: "L",
  },
  {
    title: "Expert Guides",
    description:
      "LGU-accredited guides assigned by the Tourism Office for every summit.",
    badge: "G",
  },
];

export function LandingPage(props: LandingPageProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.shell}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <MountainHeroSection />
        <ExpeditionAccessSection
          onCreateAccount={props.onCreateAccount}
          onLogIn={props.onLogIn}
        />
        <SectionDividerSection />
        <FeaturedPeaksSection onPlanExpedition={props.onHikerRegistration} />
        <EcotrailBenefitsSection />
        <HikerRegistrationSection onHikerRegistration={props.onHikerRegistration} onOrganizerSignup={props.onOrganizerSignup} />
        <TourismOfficeFooterSection lastAction={props.lastAction} />
      </View>
    </ScrollView>
  );
}

function MountainHeroSection() {
  return (
    <View style={styles.heroCard}>
      <View style={styles.headerRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <View style={styles.brandDot} />
          </View>
          <Text style={styles.brandText}>
            <Text style={styles.brandTextLight}>EcoTrail </Text>
            <Text style={styles.brandTextAccent}>Bicol</Text>
          </Text>
        </View>

        <View style={styles.livePill}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Monitoring</Text>
        </View>
      </View>

      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>Camarines Sur - Philippines</Text>
        <Text style={styles.heroTitle}>
          WHERE PEAKS{`\n`}
          <Text style={styles.heroTitleAccent}>DEMAND</Text>
          {`\n`}
          YOUR BEST.
        </Text>
        <Text style={styles.heroNote}>
          Managed expedition tracking for Camarines Sur&apos;s great mountains.
          Compliant, safe, unforgettable.
        </Text>
      </View>
    </View>
  );
}

function ExpeditionAccessSection(props: {
  onCreateAccount: () => void;
  onLogIn: () => void;
}) {
  return (
    <View style={styles.sectionBlock}>
      <Pressable
        onPress={props.onCreateAccount}
        style={({ pressed }) => [
          styles.primaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.primaryButtonText}>Create Account</Text>
      </Pressable>
      <Pressable
        onPress={props.onLogIn}
        style={({ pressed }) => [
          styles.secondaryButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text style={styles.secondaryButtonText}>Log In</Text>
      </Pressable>
    </View>
  );
}

function SectionDividerSection() {
  return (
    <View style={styles.statRow}>
      {statistics.map((stat, index) => (
        <View
          key={stat.label}
          style={[
            styles.statCard,
            index < statistics.length - 1 && styles.statCardBorder,
          ]}
        >
          <Text style={styles.statValue}>{stat.value}</Text>
          <Text style={styles.statLabel}>{stat.label}</Text>
        </View>
      ))}
    </View>
  );
}

function FeaturedPeaksSection(props: {
  onPlanExpedition: () => void;
}) {
  return (
    <View style={styles.sectionList}>
      <View style={styles.sectionEyebrowRow}>
        <View style={styles.sectionEyebrowLine} />
        <Text style={styles.sectionEyebrowText}>Featured Peaks</Text>
      </View>

      <Text style={styles.sectionTitle}>
        TWO MOUNTAINS.{`\n`}
        <Text style={styles.sectionTitleAccent}>ONE SYSTEM.</Text>
      </Text>

      {peaks.map((peak) => (
        <View key={peak.name} style={styles.peakCard}>
          <View style={[styles.peakHeader, { backgroundColor: `${peak.accent}20` }]}>
            <View style={[styles.peakGlow, { backgroundColor: peak.glow }]} />
            <View style={styles.tagRow}>
              {peak.tags.map((tag) => (
                <View key={tag} style={styles.tagPill}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>

            <View style={styles.peakHeaderBottom}>
              <Text style={styles.peakName}>{peak.name}</Text>
              <View style={styles.statusPill}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Open</Text>
              </View>
            </View>
          </View>

          <View style={styles.peakBody}>
            <View style={styles.metricGrid}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Elevation</Text>
                <Text style={styles.metricValue}>{peak.elevation}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Difficulty</Text>
                <Text style={styles.metricValue}>{peak.difficulty}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Trails</Text>
                <Text style={styles.metricValue}>{peak.trails}</Text>
              </View>
            </View>

            <Pressable
              onPress={props.onPlanExpedition}
              style={({ pressed }) => [
                styles.planButton,
                { backgroundColor: peak.accent },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.planButtonText}>Plan Expedition</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

function EcotrailBenefitsSection() {
  return (
    <View style={styles.sectionList}>
        <View style={styles.sectionEyebrowRow}>
        <View style={styles.sectionEyebrowLine} />
        <Text style={styles.sectionEyebrowText}>Why Ecotrail</Text>
      </View>

      {benefits.map((benefit, index) => (
        <View key={benefit.title} style={styles.benefitCard}>
          <View style={styles.benefitIcon}>
            <Text style={styles.benefitIconText}>{benefit.badge}</Text>
          </View>
          <View style={styles.benefitCopy}>
            <Text style={styles.benefitTitle}>{benefit.title}</Text>
            <Text style={styles.benefitDescription}>{benefit.description}</Text>
            <Text style={styles.benefitIndex}>Benefit {index + 1}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function HikerRegistrationSection(props: {
  onHikerRegistration: () => void;
  onOrganizerSignup: () => void;
}) {
  return (
    <View style={styles.registrationCard}>
      <Text style={styles.registrationKicker}>Ready to summit?</Text>
      <Text style={styles.registrationTitle}>
        YOUR EXPEDITION{`\n`}
        <Text style={styles.registrationTitleAccent}>STARTS HERE.</Text>
      </Text>

      <View style={styles.registrationButtons}>
        <Pressable
          onPress={props.onHikerRegistration}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.primaryButtonText}>Register as Hiker</Text>
        </Pressable>
        <Pressable
          onPress={props.onOrganizerSignup}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonText}>Organizer Sign-up</Text>
        </Pressable>
      </View>

      <Text style={styles.registrationNote}>
        Free for individuals - LGU-issued permits required
      </Text>
    </View>
  );
}

function TourismOfficeFooterSection(props: { lastAction: string | null }) {
  return (
    <View style={styles.footer}>
      <View style={styles.footerBrandRow}>
        <View style={styles.footerMark}>
          <View style={styles.footerDot} />
        </View>
        <Text style={styles.footerBrandText}>EcoTrail Bicol</Text>
      </View>

      <Text style={styles.footerCopy}>
        Camarines Sur Tourism Office - DENR-accredited{`\n`}Copyright 2026 All
        rights reserved
      </Text>

      {props.lastAction ? (
        <View style={styles.actionPill}>
          <Text style={styles.actionPillText}>Last action: {props.lastAction}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#070e08",
  },
  shell: {
    padding: 18,
    gap: 16,
  },
  glowTop: {
    position: "absolute",
    top: -100,
    left: -70,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(96, 215, 100, 0.12)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -90,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(74, 158, 77, 0.18)",
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "#0a1710",
    borderWidth: 1,
    borderColor: "rgba(128, 194, 231, 0.12)",
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 12,
    backgroundColor: "#4a9e4d",
    alignItems: "center",
    justifyContent: "center",
  },
  brandDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  brandTextLight: {
    color: "#e4ebe0",
  },
  brandTextAccent: {
    color: "#60d764",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(96, 215, 100, 0.5)",
    backgroundColor: "rgba(74, 158, 77, 0.25)",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#5fd664",
    opacity: 0.85,
  },
  liveText: {
    color: "#5fd664",
    fontSize: 10,
    fontWeight: "600",
  },
  heroCopy: {
    gap: 10,
  },
  heroKicker: {
    color: "#4a9e4d",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroTitle: {
    color: "#e4ebe0",
    fontSize: 40,
    lineHeight: 40,
    fontWeight: "900",
    letterSpacing: -1,
  },
  heroTitleAccent: {
    color: "#4a9e4d",
  },
  heroNote: {
    color: "#b9d5e7",
    fontSize: 13,
    lineHeight: 20,
  },
  sectionBlock: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#4a9e4d",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "rgba(228, 235, 224, 0.15)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#e4ebe0",
    fontSize: 14,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  statRow: {
    flexDirection: "row",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.15)",
    backgroundColor: "#0e1c10",
  },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  statCardBorder: {
    borderRightWidth: 1,
    borderRightColor: "rgba(74, 158, 77, 0.15)",
  },
  statValue: {
    color: "#e4ebe0",
    fontSize: 24,
    fontWeight: "900",
  },
  statLabel: {
    color: "#7a9477",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionList: {
    gap: 12,
    paddingTop: 6,
  },
  sectionEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionEyebrowLine: {
    width: 20,
    height: 1,
    backgroundColor: "#4a9e4d",
  },
  sectionEyebrowText: {
    color: "#4a9e4d",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: "#e4ebe0",
    fontSize: 30,
    lineHeight: 30,
    fontWeight: "900",
    letterSpacing: -1,
  },
  sectionTitleAccent: {
    color: "#4a9e4d",
  },
  peakCard: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.12)",
    backgroundColor: "#0e1c10",
  },
  peakHeader: {
    minHeight: 180,
    padding: 14,
    justifyContent: "space-between",
  },
  peakGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.85,
  },
  tagRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
    zIndex: 1,
  },
  tagPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(228, 235, 224, 0.15)",
    backgroundColor: "rgba(7, 14, 8, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagText: {
    color: "rgba(228, 235, 224, 0.88)",
    fontSize: 10,
    fontWeight: "600",
  },
  peakHeaderBottom: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    zIndex: 1,
    gap: 10,
  },
  peakName: {
    color: "#e4ebe0",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.3)",
    backgroundColor: "rgba(74, 158, 77, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#4a9e4d",
  },
  statusText: {
    color: "#4a9e4d",
    fontSize: 10,
    fontWeight: "700",
  },
  peakBody: {
    padding: 14,
    gap: 14,
  },
  metricGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  metricLabel: {
    color: "#7a9477",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  metricValue: {
    paddingTop: 4,
    color: "#e4ebe0",
    fontSize: 12,
    fontWeight: "700",
  },
  planButton: {
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  planButtonSelected: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
  },
  planButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  benefitCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.12)",
    backgroundColor: "#0e1c10",
    padding: 16,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74, 158, 77, 0.15)",
  },
  benefitIconText: {
    color: "#dff7ff",
    fontWeight: "900",
  },
  benefitCopy: {
    flex: 1,
  },
  benefitTitle: {
    color: "#e4ebe0",
    fontSize: 14,
    fontWeight: "700",
  },
  benefitDescription: {
    paddingTop: 4,
    color: "#7a9477",
    fontSize: 12,
    lineHeight: 18,
  },
  benefitIndex: {
    paddingTop: 8,
    color: "rgba(74, 158, 77, 0.7)",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "700",
  },
  registrationCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.2)",
    padding: 20,
    gap: 10,
    backgroundColor: "#111f14",
  },
  registrationKicker: {
    color: "#4a9e4d",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  registrationTitle: {
    color: "#e4ebe0",
    fontSize: 26,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -1,
  },
  registrationTitleAccent: {
    color: "#4a9e4d",
  },
  registrationButtons: {
    paddingTop: 8,
    gap: 10,
  },
  registrationNote: {
    paddingTop: 2,
    textAlign: "center",
    color: "#7a9477",
    fontSize: 10,
    lineHeight: 15,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "rgba(74, 158, 77, 0.08)",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 20,
  },
  footerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingTop: 4,
  },
  footerMark: {
    width: 20,
    height: 20,
    borderRadius: 14,
    backgroundColor: "#4a9e4d",
    alignItems: "center",
    justifyContent: "center",
  },
  footerDot: {
    width: 11,
    height: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
  },
  footerBrandText: {
    color: "#e4ebe0",
    fontSize: 12,
    fontWeight: "700",
  },
  footerCopy: {
    color: "rgba(122, 148, 119, 0.8)",
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
  actionPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  actionPillText: {
    color: "rgba(228, 235, 224, 0.85)",
    fontSize: 10,
  },
});
