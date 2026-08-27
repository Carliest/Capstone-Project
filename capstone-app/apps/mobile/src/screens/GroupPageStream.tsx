import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BadgeCheck, ChevronRight, FileText, MapPin, Mountain, Users } from "lucide-react-native";
import { createApiClient } from "../api";
import { EventHeroSection } from "../components/EventHeroSection";
import { EventNavigationTabsSection, type NavigationTab } from "../components/EventNavigationTabsSection";
import { EventStreamCard } from "../components/EventStreamCard";
import { PendingTasksAlertSection } from "../components/PendingTasksAlertSection";
import { SyncStatusBanner } from "../components/SyncStatusBanner";
import { readStoredValue, SESSION_STORAGE_KEY } from "../storage";
import { getCachedTimestamp, getCachedValue, setCachedValue } from "../offlineCache";
import { useBackendSyncStatus } from "../hooks/useBackendSyncStatus";
import type {
  JoinedGroup,
  ManifestAnnouncement,
  ManifestCheckpoint,
  ManifestComplianceDocument,
  ManifestPerson,
  ManifestRequirements,
  ManifestRequiredDocument,
  ManifestTrail,
  ManifestTrailMaterial,
} from "../types/manifest";

type GroupPageStreamProps = {
  manifest: JoinedGroup | null;
  onBack: () => void;
};

type SessionPayload = {
  token: string;
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    profile_picture?: string | null;
  };
};

type AnnouncementsResponse = {
  announcements: Array<ManifestAnnouncement & { organizer_name?: string | null }>;
};

type RequirementsResponse = {
  requirements: ManifestRequirements;
};

type TrailMaterialsResponse = {
  trailMaterials: ManifestTrailMaterial[];
};

type TrailResponse = {
  trail: ManifestTrail | null;
  gps: ManifestTrail["gps"];
};

type PeopleResponse = {
  people: ManifestPerson[];
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
const apiClient = apiBaseUrl ? createApiClient(apiBaseUrl) : null;
const MANIFEST_CACHE_PREFIX = "offline-cache:manifest:";

type ManifestSnapshot = {
  announcements: AnnouncementsResponse["announcements"];
  trailMaterials: ManifestTrailMaterial[];
  requiredDocuments: ManifestRequiredDocument[];
  complianceDocuments: ManifestComplianceDocument[];
  trail: ManifestTrail | null;
  trailGps: ManifestTrail["gps"];
  people: ManifestPerson[];
};

export function GroupPageStream({ manifest, onBack }: GroupPageStreamProps) {
  const [activeTab, setActiveTab] = useState<NavigationTab>("Stream");
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementsResponse["announcements"]>([]);
  const [trailMaterials, setTrailMaterials] = useState<ManifestTrailMaterial[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<ManifestRequiredDocument[]>([]);
  const [complianceDocuments, setComplianceDocuments] = useState<ManifestComplianceDocument[]>([]);
  const [trail, setTrail] = useState<ManifestTrail | null>(null);
  const [trailGps, setTrailGps] = useState<ManifestTrail["gps"]>(null);
  const [people, setPeople] = useState<ManifestPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSavingCheckpoint, setIsSavingCheckpoint] = useState(false);
  const [activeSyncOperations, setActiveSyncOperations] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const backendSync = useBackendSyncStatus(apiBaseUrl);

  const manifestId = manifest?.manifest_id ?? null;
  const isSyncing = activeSyncOperations > 0;

  const pendingCount = useMemo(() => {
    const requiredCount = requiredDocuments.filter((document) => document.is_required).length;
    const uploadedCount = complianceDocuments.length;
    return Math.max(requiredCount - uploadedCount, 0);
  }, [requiredDocuments, complianceDocuments]);

  useEffect(() => {
    setActiveTab("Stream");
  }, [manifestId]);

  useEffect(() => {
    void bootstrap();
  }, [manifestId]);

  async function bootstrap() {
    if (!manifestId) {
      setStatusMessage("Select a manifest to view its room.");
      setIsLoading(false);
      return;
    }

    const storedSession = await readStoredValue(SESSION_STORAGE_KEY);
    if (!storedSession) {
      await loadCachedManifest(manifestId, "Please log in again to view the stream.");
      setIsLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as SessionPayload;
      if (!parsed?.token) {
        throw new Error("Session token is missing.");
      }

      setSession(parsed);
      if (!apiClient) {
        await loadCachedManifest(
          manifestId,
          "Set EXPO_PUBLIC_API_URL to your backend URL before loading the room."
        );
        return;
      }

      await loadManifestData(parsed.token, manifestId);
      setStatusMessage("");
    } catch (error) {
      await loadCachedManifest(
        manifestId,
        error instanceof Error ? error.message : "Unable to load the stream."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadManifestData(token: string, id: string) {
    return runWithSyncTracking(async () => {
      const results = await Promise.allSettled([
        apiClient!.get<AnnouncementsResponse>(`/api/announcements?manifestId=${encodeURIComponent(id)}`, token),
        apiClient!.get<TrailMaterialsResponse>(`/api/manifests/${id}/trail-materials`, token),
        apiClient!.get<RequirementsResponse>(`/api/manifests/${id}/requirements`, token),
        apiClient!.get<TrailResponse>(`/api/manifests/${id}/trail`, token),
        apiClient!.get<PeopleResponse>(`/api/manifests/${id}/people`, token),
      ]);

      const sectionErrors: string[] = [];
      const snapshot: ManifestSnapshot = {
        announcements: [],
        trailMaterials: [],
        requiredDocuments: [],
        complianceDocuments: [],
        trail: null,
        trailGps: null,
        people: [],
      };

      const announcementsResult = results[0];
      if (announcementsResult.status === "fulfilled") {
        snapshot.announcements = announcementsResult.value.announcements;
      } else {
        sectionErrors.push("announcements");
      }

      const trailMaterialsResult = results[1];
      if (trailMaterialsResult.status === "fulfilled") {
        snapshot.trailMaterials = trailMaterialsResult.value.trailMaterials;
      } else {
        sectionErrors.push("trail materials");
      }

      const requirementsResult = results[2];
      if (requirementsResult.status === "fulfilled") {
        snapshot.requiredDocuments = requirementsResult.value.requirements.requiredDocuments ?? [];
        snapshot.complianceDocuments = requirementsResult.value.requirements.complianceDocuments;
        if (trailMaterialsResult.status !== "fulfilled") {
          snapshot.trailMaterials = requirementsResult.value.requirements.trailMaterials;
        }
      } else {
        sectionErrors.push("requirements");
      }

      const trailResult = results[3];
      if (trailResult.status === "fulfilled") {
        snapshot.trail = trailResult.value.trail;
        snapshot.trailGps = trailResult.value.gps;
      } else {
        sectionErrors.push("trail");
      }

      const peopleResult = results[4];
      if (peopleResult.status === "fulfilled") {
        snapshot.people = peopleResult.value.people;
      } else {
        sectionErrors.push("people");
      }

      setAnnouncements(snapshot.announcements);
      setTrailMaterials(snapshot.trailMaterials);
      setRequiredDocuments(snapshot.requiredDocuments);
      setComplianceDocuments(snapshot.complianceDocuments);
      setTrail(snapshot.trail);
      setTrailGps(snapshot.trailGps);
      setPeople(snapshot.people);

      await setCachedValue(`${MANIFEST_CACHE_PREFIX}${id}`, snapshot);
      setLastSyncedAt(Date.now());

      if (sectionErrors.length > 0) {
        setStatusMessage(`Some sections could not be loaded: ${sectionErrors.join(", ")}.`);
      }
    });
  }

  async function handleCheckpointLog(checkpoint: ManifestCheckpoint) {
    if (!manifestId || !session?.token || !apiClient) {
      return;
    }

    try {
      setIsSavingCheckpoint(true);
      await runWithSyncTracking(async () => {
        await apiClient.post(
          "/api/tracking/checkpoint-log",
          {
            manifestId,
            checkpointId: checkpoint.checkpoint_id,
          },
          session.token
        );

        await loadManifestData(session.token, manifestId);
        Alert.alert("Checkpoint saved", `${checkpoint.checkpoint_name} timestamp recorded.`);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save checkpoint.";
      Alert.alert("Checkpoint failed", message);
    } finally {
      setIsSavingCheckpoint(false);
    }
  }

  async function loadCachedManifest(id: string, fallbackMessage: string) {
    const cached = await getCachedValue<ManifestSnapshot>(`${MANIFEST_CACHE_PREFIX}${id}`);
    if (!cached) {
      setStatusMessage(fallbackMessage);
      return;
    }

    setAnnouncements(cached.announcements ?? []);
    setTrailMaterials(cached.trailMaterials ?? []);
    setRequiredDocuments(cached.requiredDocuments ?? []);
    setComplianceDocuments(cached.complianceDocuments ?? []);
    setTrail(cached.trail ?? null);
    setTrailGps(cached.trailGps ?? null);
    setPeople(cached.people ?? []);
    const cachedTimestamp = await getCachedTimestamp(`${MANIFEST_CACHE_PREFIX}${id}`);
    setLastSyncedAt(cachedTimestamp);
    setStatusMessage("Offline mode: showing the last synced manifest data from SQLite.");
  }

  async function runWithSyncTracking<T>(task: () => Promise<T>) {
    setActiveSyncOperations((current) => current + 1);
    try {
      return await task();
    } finally {
      setActiveSyncOperations((current) => Math.max(0, current - 1));
    }
  }

  const nextCheckpoint =
    trail?.checkpoints.find((checkpoint) => !checkpoint.arrival_timestamp) ??
    trail?.checkpoints[0] ??
    null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EventHeroSection manifest={manifest} onBack={onBack} />
        <SyncStatusBanner
          title="manifest room"
          isOnline={backendSync.isOnline}
          isChecking={backendSync.isChecking}
          isSyncing={isSyncing}
          lastSyncedAt={lastSyncedAt}
        />
        <PendingTasksAlertSection pendingCount={pendingCount || 0} />
        <EventNavigationTabsSection activeTab={activeTab} onTabChange={setActiveTab} />

        {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

        <View style={styles.section}>
          {isLoading ? (
            <SectionLoading />
          ) : activeTab === "Stream" ? (
            <StreamTab announcements={announcements} trailMaterials={trailMaterials} complianceDocuments={complianceDocuments} />
          ) : activeTab === "Requirements" ? (
            <RequirementsTab trailMaterials={trailMaterials} complianceDocuments={complianceDocuments} />
          ) : activeTab === "Trail" ? (
            <TrailTab
              trail={trail}
              gps={trailGps}
              nextCheckpoint={nextCheckpoint}
              onLogCheckpoint={handleCheckpointLog}
              isSavingCheckpoint={isSavingCheckpoint}
            />
          ) : (
            <PeopleTab manifest={manifest} people={people} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SectionLoading() {
  return (
    <View style={styles.loadingCard}>
      <Text style={styles.loadingTitle}>Loading manifest details</Text>
      <Text style={styles.loadingBody}>
        Pulling announcements, trail materials, requirements, trail GPS, and room members from the database.
      </Text>
    </View>
  );
}

function StreamTab({
  announcements,
  trailMaterials,
  complianceDocuments,
}: {
  announcements: Array<ManifestAnnouncement & { organizer_name?: string | null }>;
  trailMaterials: ManifestTrailMaterial[];
  complianceDocuments: ManifestComplianceDocument[];
}) {
  return (
    <View style={styles.tabStack}>
      <SectionHeader title="Announcements" subtitle="Organizer posts that belong to this manifest room." />
      {announcements.length > 0 ? (
        <View style={styles.stackGap}>
          {announcements.map((announcement) => (
            <ManifestListCard
              key={announcement.announcement_id}
              icon={<FileText size={16} color="#1a5276" strokeWidth={2.2} />}
              accent="#1a5276"
              title={announcement.title}
              subtitle={formatDateTime(announcement.created_at)}
              body={announcement.content}
              badge={announcement.organizer_name ?? "Organizer"}
            />
          ))}
        </View>
      ) : (
        <EmptyState title="No announcements yet" body="Organizer updates will appear here." />
      )}

      <SectionHeader title="Trail materials" subtitle="LGU trail resource materials tied to this expedition." />
      <MaterialList items={trailMaterials} />

      <SectionHeader title="Hiker compliance" subtitle="Your submitted compliance documents for this manifest." />
      <ComplianceList items={complianceDocuments} />
    </View>
  );
}

function RequirementsTab({
  trailMaterials,
  complianceDocuments,
}: {
  trailMaterials: ManifestTrailMaterial[];
  complianceDocuments: ManifestComplianceDocument[];
}) {
  return (
    <View style={styles.tabStack}>
      <SectionHeader title="Trail materials" subtitle="LGU-provided videos, PDFs, and file references." />
      <MaterialList items={trailMaterials} />

      <SectionHeader title="Hiker compliance" subtitle="Organizer-required documents the hiker must submit." />
      <ComplianceList items={complianceDocuments} />
    </View>
  );
}

function TrailTab({
  trail,
  gps,
  nextCheckpoint,
  onLogCheckpoint,
  isSavingCheckpoint,
}: {
  trail: ManifestTrail | null;
  gps: ManifestTrail["gps"];
  nextCheckpoint: ManifestCheckpoint | null;
  onLogCheckpoint: (checkpoint: ManifestCheckpoint) => Promise<void>;
  isSavingCheckpoint: boolean;
}) {
  if (!trail) {
    return (
      <EmptyState
        title="No trail assigned"
        body="This manifest does not have a trail yet, so there are no checkpoints to scan."
      />
    );
  }

  const completed = trail.progress.completedCount;
  const total = trail.progress.totalCount;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const gpsLabel =
    gps?.placeName ?? gps?.text ?? trail.trailName ?? trail.locationDescription ?? "Trail GPS";
  const gpsCoords = gps?.coordinates
    ? `${gps.coordinates[1].toFixed(5)}, ${gps.coordinates[0].toFixed(5)}`
    : "Coordinates unavailable";

  return (
    <View style={styles.tabStack}>
      <View style={styles.progressCard}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressCircleText}>{total > 0 ? `${completed}/${total}` : "0/0"}</Text>
        </View>
        <View style={styles.progressCopy}>
          <Text style={styles.progressTitle}>Trail Progress</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(percent, 8)}%` }]} />
          </View>
          <Text style={styles.progressCaption}>
            Next: {trail.progress.nextCheckpointName ?? "Awaiting checkpoint assignment"}
          </Text>
        </View>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapHeader}>
          <Text style={styles.mapTitle}>{trail.trailName ?? "Trail map"}</Text>
          <Text style={styles.mapSubtitle}>{trail.mountainName ?? "Mountain route"}</Text>
        </View>

        <View style={styles.gpsCard}>
          <View style={styles.gpsIcon}>
            <MapPin size={16} color="#2f6f32" strokeWidth={2.2} />
          </View>
          <View style={styles.gpsCopy}>
            <Text style={styles.gpsTitle}>{gpsLabel}</Text>
            <Text style={styles.gpsBody}>{gpsCoords}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{gps?.found ? "Mapbox" : "Fallback"}</Text>
          </View>
        </View>

        <View style={styles.mapBody}>
          {trail.checkpoints.map((checkpoint, index) => {
            const completedCheckpoint = Boolean(checkpoint.arrival_timestamp);

            return (
              <View key={checkpoint.checkpoint_id} style={styles.mapNodeRow}>
                <View
                  style={[
                    styles.mapNode,
                    completedCheckpoint ? styles.mapNodeComplete : styles.mapNodeIdle,
                  ]}
                >
                  <Text style={styles.mapNodeText}>{index + 1}</Text>
                </View>
                <View style={styles.mapNodeContent}>
                  <Text style={styles.mapNodeTitle}>{checkpoint.checkpoint_name}</Text>
                  <Text style={styles.mapNodeBody}>{completedCheckpoint ? "Timestamp saved" : "Awaiting scan"}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <EventStreamCard
        button
        ariaLabel={`Scan ${nextCheckpoint?.checkpoint_name ?? "next checkpoint"}`}
        onClick={() => {
          if (nextCheckpoint) {
            void onLogCheckpoint(nextCheckpoint);
          }
        }}
      >
        <View style={styles.scannerCard}>
          <View style={styles.scannerFrame}>
            <View style={styles.scannerCornerTopLeft} />
            <View style={styles.scannerCornerTopRight} />
            <View style={styles.scannerCornerBottomLeft} />
            <View style={styles.scannerCornerBottomRight} />
            <View style={styles.scannerCenter}>
              <Mountain size={20} color="#315c2f" strokeWidth={2.1} />
            </View>
          </View>

          <View style={styles.scannerContent}>
            <Text style={styles.scannerTitle}>Checkpoint scan</Text>
            <Text style={styles.scannerBody}>
              Tap the active checkpoint when its QR code is scanned during the hike.
            </Text>
            <View style={styles.scannerButton}>
              <Text style={styles.scannerButtonText}>
                {isSavingCheckpoint ? "Saving timestamp..." : `Scan: ${nextCheckpoint?.checkpoint_name ?? "Checkpoint"}`}
              </Text>
            </View>
          </View>
        </View>
      </EventStreamCard>

      <SectionHeader title="Checkpoints" subtitle="Recorded campsites for this trail." />
      {trail.checkpoints.length > 0 ? (
        <View style={styles.stackGap}>
          {trail.checkpoints.map((checkpoint, index) => (
            <CheckpointCard
              key={checkpoint.checkpoint_id}
              checkpoint={checkpoint}
              index={index}
              onPress={() => void onLogCheckpoint(checkpoint)}
              disabled={isSavingCheckpoint}
            />
          ))}
        </View>
      ) : (
        <EmptyState
          title="No checkpoints"
          body="The organizer or LGU still needs to create the checkpoint stations for this trail."
        />
      )}
    </View>
  );
}

function PeopleTab({
  manifest,
  people,
}: {
  manifest: JoinedGroup | null;
  people: ManifestPerson[];
}) {
  const organizerAndGuide = people.filter(
    (person) => person.manifest_role === "organizer" || person.manifest_role === "guide"
  );
  const hikers = people.filter((person) => person.manifest_role === "hiker");
  const fallbackOrganizerCount = organizerAndGuide.length > 0 || !manifest?.organizer_name ? 0 : 1;
  const visiblePeopleCount = organizerAndGuide.length + hikers.length + fallbackOrganizerCount;

  return (
    <View style={styles.tabStack}>
      <SectionHeader
        title={`Manifest room (${visiblePeopleCount})`}
        subtitle="Organizer, guide, and hikers assigned to this expedition."
      />

      {organizerAndGuide.length > 0 ? (
        <PeopleSection title="Organizer & Guide" people={organizerAndGuide} />
      ) : manifest?.organizer_name ? (
        <PeopleSection
          title="Organizer & Guide"
          people={[
            {
              person_id: manifest.manifest_id,
              manifest_role: "organizer",
              display_name: manifest.organizer_name,
              email: null,
              profile_picture: null,
              joined_at: null,
              hiker_readiness_status: null,
            },
          ]}
        />
      ) : null}

      {hikers.length > 0 ? <PeopleSection title={`Hikers (${hikers.length})`} people={hikers} /> : null}

      {organizerAndGuide.length === 0 && hikers.length === 0 ? (
        <EmptyState title="No people found" body="This room is still waiting for assignments." />
      ) : null}
    </View>
  );
}

function PeopleSection({ title, people }: { title: string; people: ManifestPerson[] }) {
  return (
    <View style={styles.peopleSection}>
      <Text style={styles.peopleSectionTitle}>{title}</Text>
      <View style={styles.stackGap}>
        {people.map((person) => (
          <PersonCard key={person.person_id} person={person} />
        ))}
      </View>
    </View>
  );
}

function PersonCard({ person }: { person: ManifestPerson }) {
  const initials = getInitials(person.display_name);
  const roleLabel =
    person.manifest_role === "organizer"
      ? "Organizer"
      : person.manifest_role === "guide"
        ? "Guide"
        : "Hiker";

  return (
    <View style={styles.personCard}>
      <View
        style={[
          styles.personAvatar,
          { backgroundColor: person.manifest_role === "hiker" ? "#ebe8df" : "#e8f3e6" },
        ]}
      >
        {person.profile_picture ? (
          <Image source={{ uri: person.profile_picture }} style={styles.personAvatarImage} resizeMode="cover" />
        ) : (
          <Text style={styles.personAvatarText}>{initials}</Text>
        )}
      </View>

      <View style={styles.personCopy}>
        <Text style={styles.personName}>{person.display_name}</Text>
        <Text style={styles.personRole}>{roleLabel}</Text>
        {person.manifest_role === "hiker" ? (
          <Text style={styles.personMeta}>
            Joined {formatDateTime(person.joined_at)} · {person.hiker_readiness_status ?? "pending"}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function ManifestListCard({
  icon,
  accent,
  title,
  subtitle,
  body,
  badge,
}: {
  icon: ReactNode;
  accent: string;
  title: string;
  subtitle: string;
  body: string;
  badge?: string;
}) {
  return (
    <View style={styles.listCard}>
      <View style={[styles.listIcon, { backgroundColor: `${accent}1a` }]}>{icon}</View>
      <View style={styles.listContent}>
        <Text style={styles.listTitle}>{title}</Text>
        <Text style={styles.listSubtitle}>{subtitle}</Text>
        <Text style={styles.listBody}>{body}</Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <ChevronRight size={16} color="#7a9477" strokeWidth={2.2} />
    </View>
  );
}

function MaterialList({ items }: { items: ManifestTrailMaterial[] }) {
  if (items.length === 0) {
    return <EmptyState title="No materials yet" body="The LGU has not added any trail materials." />;
  }

  return (
    <View style={styles.stackGap}>
      {items.map((item) => (
        <ManifestListCard
          key={item.trail_material_id}
          icon={<FileText size={16} color="#c8892a" strokeWidth={2.2} />}
          accent="#c8892a"
          title={item.title}
          subtitle={item.material_type.toUpperCase()}
          body={item.description ?? item.resource_url ?? "No description provided."}
          badge={item.material_type}
        />
      ))}
    </View>
  );
}

function ComplianceList({ items }: { items: ManifestComplianceDocument[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No compliance uploads"
        body="Hiker-submitted compliance files will show up here once uploaded."
      />
    );
  }

  return (
    <View style={styles.stackGap}>
      {items.map((item) => (
        <ManifestListCard
          key={item.document_id}
          icon={<BadgeCheck size={16} color="#1a5276" strokeWidth={2.2} />}
          accent="#1a5276"
          title={item.document_name}
          subtitle={item.verification_status.replace(/_/g, " ")}
          body={`${fileNameFromUrl(item.uploaded_file_url)} - ${formatDateTime(item.created_at)}`}
          badge={item.verification_status}
        />
      ))}
    </View>
  );
}

function CheckpointCard({
  checkpoint,
  index,
  onPress,
  disabled,
}: {
  checkpoint: ManifestCheckpoint;
  index: number;
  onPress: () => void;
  disabled: boolean;
}) {
  const completed = Boolean(checkpoint.arrival_timestamp);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.checkpointCard,
        pressed && styles.cardPressed,
        completed && styles.checkpointCardComplete,
      ]}
    >
      <View style={[styles.checkpointIndex, completed ? styles.checkpointIndexComplete : null]}>
        <Text style={styles.checkpointIndexText}>{index + 1}</Text>
      </View>
      <View style={styles.checkpointContent}>
        <Text style={styles.checkpointTitle}>{checkpoint.checkpoint_name}</Text>
        <Text style={styles.checkpointBody}>
          {completed
            ? `Logged at ${formatDateTime(checkpoint.arrival_timestamp)}`
            : "Tap to save the next timestamp"}
        </Text>
      </View>
      <ChevronRight size={16} color="#7a9477" strokeWidth={2.2} />
    </Pressable>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
    </View>
  );
}

function formatDateTime(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "Pending";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Pending";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "H"
  );
}

function fileNameFromUrl(url: string) {
  try {
    const value = new URL(url).pathname.split("/").pop();
    return value ?? "Uploaded file";
  } catch {
    return "Uploaded file";
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f5f2ed",
  },
  content: {
    paddingBottom: 24,
  },
  statusText: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  tabStack: {
    gap: 14,
  },
  stackGap: {
    gap: 10,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#243524",
    fontSize: 18,
    fontWeight: "900",
  },
  sectionSubtitle: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  peopleSection: {
    gap: 10,
  },
  peopleSectionTitle: {
    color: "#71806d",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  personCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 14,
  },
  personAvatar: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  personAvatarImage: {
    width: "100%",
    height: "100%",
  },
  personAvatarText: {
    color: "#6f7d68",
    fontSize: 14,
    fontWeight: "800",
  },
  personCopy: {
    flex: 1,
    gap: 2,
  },
  personName: {
    color: "#243524",
    fontSize: 15,
    fontWeight: "800",
  },
  personRole: {
    color: "#7b8877",
    fontSize: 12,
    fontWeight: "700",
  },
  personMeta: {
    color: "#93a090",
    fontSize: 11,
    lineHeight: 16,
  },
  loadingCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 16,
    gap: 6,
  },
  loadingTitle: {
    color: "#243524",
    fontSize: 15,
    fontWeight: "900",
  },
  loadingBody: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  listCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  listIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  listContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  listTitle: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  listSubtitle: {
    color: "#7a9477",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  listBody: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  badge: {
    borderRadius: 999,
    backgroundColor: "#f5f2ed",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#6b7a68",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  emptyState: {
    borderRadius: 18,
    backgroundColor: "#faf8f2",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 16,
    gap: 4,
  },
  emptyTitle: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyBody: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  progressCard: {
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7f2e8",
  },
  progressCircleText: {
    color: "#2f6f32",
    fontSize: 16,
    fontWeight: "900",
  },
  progressCopy: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  progressTitle: {
    color: "#243524",
    fontSize: 15,
    fontWeight: "900",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e8e4db",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2f6f32",
  },
  progressCaption: {
    color: "#6b7a68",
    fontSize: 12,
  },
  mapCard: {
    borderRadius: 20,
    backgroundColor: "#dfeccc",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 14,
    gap: 12,
  },
  mapHeader: {
    gap: 2,
  },
  mapTitle: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  mapSubtitle: {
    color: "#6b7a68",
    fontSize: 12,
  },
  gpsCard: {
    borderRadius: 16,
    backgroundColor: "#f7fbf4",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  gpsIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e7f2e8",
    alignItems: "center",
    justifyContent: "center",
  },
  gpsCopy: {
    flex: 1,
    minWidth: 0,
  },
  gpsTitle: {
    color: "#243524",
    fontSize: 13,
    fontWeight: "900",
  },
  gpsBody: {
    color: "#6b7a68",
    fontSize: 11,
    marginTop: 2,
  },
  mapBody: {
    gap: 12,
  },
  mapNodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mapNode: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  mapNodeIdle: {
    borderColor: "#a3b69a",
    backgroundColor: "#edf4e4",
  },
  mapNodeComplete: {
    borderColor: "#2f6f32",
    backgroundColor: "#e7f2e8",
  },
  mapNodeText: {
    color: "#243524",
    fontSize: 11,
    fontWeight: "900",
  },
  mapNodeContent: {
    flex: 1,
    minWidth: 0,
  },
  mapNodeTitle: {
    color: "#243524",
    fontSize: 13,
    fontWeight: "800",
  },
  mapNodeBody: {
    color: "#6b7a68",
    fontSize: 11,
    marginTop: 1,
  },
  scannerCard: {
    padding: 14,
    gap: 12,
  },
  scannerFrame: {
    height: 180,
    borderRadius: 18,
    backgroundColor: "#0e1a0f",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  scannerCornerTopLeft: {
    position: "absolute",
    top: 14,
    left: 14,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#2f6f32",
  },
  scannerCornerTopRight: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 24,
    height: 24,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: "#2f6f32",
  },
  scannerCornerBottomLeft: {
    position: "absolute",
    bottom: 14,
    left: 14,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: "#2f6f32",
  },
  scannerCornerBottomRight: {
    position: "absolute",
    bottom: 14,
    right: 14,
    width: 24,
    height: 24,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: "#2f6f32",
  },
  scannerCenter: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  scannerContent: {
    gap: 6,
  },
  scannerTitle: {
    color: "#243524",
    fontSize: 15,
    fontWeight: "900",
  },
  scannerBody: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  scannerButton: {
    borderRadius: 16,
    backgroundColor: "#2f6f32",
    paddingVertical: 14,
    alignItems: "center",
  },
  scannerButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  checkpointCard: {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkpointCardComplete: {
    backgroundColor: "#f7fbf4",
  },
  cardPressed: {
    opacity: 0.92,
  },
  checkpointIndex: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f0ebdf",
    alignItems: "center",
    justifyContent: "center",
  },
  checkpointIndexComplete: {
    backgroundColor: "#e7f2e8",
  },
  checkpointIndexText: {
    color: "#243524",
    fontSize: 11,
    fontWeight: "900",
  },
  checkpointContent: {
    flex: 1,
    minWidth: 0,
  },
  checkpointTitle: {
    color: "#243524",
    fontSize: 14,
    fontWeight: "900",
  },
  checkpointBody: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
});
