import { Pressable, ScrollView, Text, View } from "react-native";
import { landingStyles as styles } from "./LandingPage.styles";

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
