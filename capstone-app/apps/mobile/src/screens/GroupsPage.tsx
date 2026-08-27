import { useEffect, useMemo, useState } from "react";
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
  Image,
} from "react-native";
import {
  BookOpenText,
  CalendarDays,
  ChevronRight,
  FileText,
  MapPin,
  Mountain,
  Plus,
  Search,
  UserRound,
  Users,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { createApiClient } from "../api";
import { SyncStatusBanner } from "../components/SyncStatusBanner";
import {
  SESSION_STORAGE_KEY,
  deleteStoredValue,
  readStoredValue,
} from "../storage";
import { getCachedTimestamp, getCachedValue, setCachedValue } from "../offlineCache";
import { useBackendSyncStatus } from "../hooks/useBackendSyncStatus";
import { BottomNavigation } from "../components/BottomNavigation";
import { ManifestCard } from "../components/ManifestCard";
import type { JoinedGroup, LookupManifest } from "../types/manifest";

type GroupsPageProps = {
  onLogout: () => void;
  onOpenStream: (manifest: JoinedGroup) => void;
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

type GroupsResponse = {
  groups: JoinedGroup[];
  count: number;
};

type JoinResponse = {
  manifestHiker: unknown;
  message?: string;
};

type LookupResponse = {
  manifest: LookupManifest;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
const apiClient = apiBaseUrl ? createApiClient(apiBaseUrl) : null;
const GROUPS_CACHE_KEY = "offline-cache:groups";
const MANIFEST_LOOKUP_CACHE_PREFIX = "offline-cache:manifest-lookup:";

export function GroupsPage({ onLogout, onOpenStream }: GroupsPageProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [groups, setGroups] = useState<JoinedGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [preview, setPreview] = useState<LookupManifest | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Groups");
  const [activeSyncOperations, setActiveSyncOperations] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const backendSync = useBackendSyncStatus(apiBaseUrl);

  const isSyncing = activeSyncOperations > 0;

  useEffect(() => {
    void bootstrap();
  }, []);

  const displayName = useMemo(() => {
    const firstName = session?.user?.first_name?.trim() ?? "";
    const lastName = session?.user?.last_name?.trim() ?? "";
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName || session?.user?.email || "Hiker";
  }, [session]);

  const initials = useMemo(() => {
    return displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "H";
  }, [displayName]);

  const profilePicture = session?.user?.profile_picture?.trim() ?? "";

  function openJoinModal() {
    setStatusMessage("");
    setIsPreviewOpen(true);
  }

  async function bootstrap() {
    const storedSession = await readStoredValue(SESSION_STORAGE_KEY);
    if (!storedSession) {
      setStatusMessage("Please log in again to view your groups.");
      setIsLoadingGroups(false);
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as SessionPayload;
      if (!parsed?.token) {
        throw new Error("Session token is missing.");
      }

      setSession(parsed);
      if (!apiClient) {
        const cachedGroups = await getCachedGroups();
        if (cachedGroups) {
          setStatusMessage(
            "Offline mode: showing your last synced groups from SQLite."
          );
          return;
        }

        setStatusMessage(
          "Set EXPO_PUBLIC_API_URL to your backend URL before loading groups."
        );
        return;
      }

      await loadGroups(parsed.token);
      setStatusMessage("");
    } catch (error) {
      const cachedGroups = await getCachedGroups();
      if (cachedGroups) {
        setStatusMessage(
          "Offline mode: showing your last synced groups from SQLite."
        );
        return;
      }

      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load your session."
      );
    } finally {
      setIsLoadingGroups(false);
    }
  }

  async function loadGroups(token: string) {
    return runWithSyncTracking(async () => {
      const result = await apiClient!.get<GroupsResponse>("/api/manifests/mine", token);
      setGroups(result.groups);
      await setCachedValue(GROUPS_CACHE_KEY, result);
      setLastSyncedAt(Date.now());
    });
  }

  async function lookupManifest(roomCodeInput?: string) {
    const code = (roomCodeInput ?? roomCode).trim().toUpperCase();
    if (!code) {
      setStatusMessage("Please enter a room code.");
      return;
    }

    if (!session?.token) {
      setStatusMessage("Please log in again to search for a manifest.");
      return;
    }

    try {
      setIsSearching(true);
      setStatusMessage("");

      await runWithSyncTracking(async () => {
        const result = await apiClient!.get<LookupResponse>(
          `/api/manifests/lookup?roomCode=${encodeURIComponent(code)}`,
          session.token
        );

        setPreview(result.manifest);
        setIsPreviewOpen(true);
        await setCachedValue(`${MANIFEST_LOOKUP_CACHE_PREFIX}${code}`, result.manifest);
        setLastSyncedAt(Date.now());
      });
    } catch (error) {
      const cachedPreview = await getCachedValue<LookupManifest>(
        `${MANIFEST_LOOKUP_CACHE_PREFIX}${code}`
      );
      if (cachedPreview) {
        setPreview(cachedPreview);
        setIsPreviewOpen(true);
        setStatusMessage(
          "Offline mode: showing the last cached manifest preview for that room code."
        );
        return;
      }

      const message =
        error instanceof Error ? error.message : "Unable to load manifest.";
      setStatusMessage(message);
      Alert.alert("Manifest not found", message);
    } finally {
      setIsSearching(false);
    }
  }

  async function handleJoinGroup(roomCodeInput?: string) {
    const code = (roomCodeInput ?? roomCode).trim().toUpperCase();
    if (!code) {
      setStatusMessage("Please enter a room code.");
      return;
    }

    if (!session?.token) {
      setStatusMessage("Please log in again to join a group.");
      return;
    }

    try {
      setIsJoining(true);
      setStatusMessage("");

      await runWithSyncTracking(async () => {
        const result = await apiClient!.post<JoinResponse>(
          "/api/manifests/join",
          { roomCode: code },
          session.token
        );

        await loadGroups(session.token);
        setIsPreviewOpen(false);
        setPreview(null);
        setRoomCode("");
        Alert.alert(
          "Group joined",
          result.message ?? "You have been added to the expedition group."
        );
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to join the group.";
      setStatusMessage(message);
      Alert.alert("Join failed", message);
    } finally {
      setIsJoining(false);
    }
  }

  async function handleLogout() {
    try {
      await deleteStoredValue(SESSION_STORAGE_KEY);
    } finally {
      onLogout();
    }
  }

  async function getCachedGroups() {
    const cached = await getCachedValue<GroupsResponse>(GROUPS_CACHE_KEY);
    if (!cached?.groups?.length) {
      return null;
    }

    setGroups(cached.groups);
    const cachedTimestamp = await getCachedTimestamp(GROUPS_CACHE_KEY);
    setLastSyncedAt(cachedTimestamp);
    return cached;
  }

  async function runWithSyncTracking<T>(task: () => Promise<T>) {
    setActiveSyncOperations((current) => current + 1);
    try {
      return await task();
    } finally {
      setActiveSyncOperations((current) => Math.max(0, current - 1));
    }
  }

  const showManifestList = !isLoadingGroups && groups.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.shell}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.headerRow}>
              <View style={styles.identityRow}>
                <View
                  style={styles.avatar}
                  accessible
                  accessibilityLabel={`${displayName} profile picture`}
                >
                  {profilePicture ? (
                    <Image
                      source={{ uri: profilePicture }}
                      style={styles.avatarImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.avatarText}>{initials}</Text>
                  )}
                </View>
                <View style={styles.identityCopy}>
                  <Text style={styles.brandKicker}>EcoTrail Bicol</Text>
                  <Text style={styles.displayName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Text style={styles.groupCount}>
                    {groups.length} group{groups.length === 1 ? "" : "s"} joined
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.logoutButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          </View>

          <SyncStatusBanner
            title="groups"
            isOnline={backendSync.isOnline}
            isChecking={backendSync.isChecking}
            isSyncing={isSyncing}
            lastSyncedAt={lastSyncedAt}
          />

          {showManifestList ? (
            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Text style={styles.sectionEyebrow}>Groups</Text>
                <Text style={styles.sectionTitle}>Your expedition rooms</Text>
                <Text style={styles.sectionSubtitle}>
                  Current manifests you are part of.
                </Text>
              </View>

              <View style={styles.manifestList}>
                {groups.map((group) => (
                  <ManifestCard
                    key={group.manifest_id}
                    manifest={group}
                    description={buildManifestDescription(group)}
                    onPress={() => onOpenStream(group)}
                    onViewStream={() => onOpenStream(group)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.searchSection}>
            
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Mountain size={38} strokeWidth={2.1} color="#2f6f32" />
                </View>
                <Text style={styles.emptyTitle}>No groups yet</Text>
                <Text style={styles.emptyText}>
                  Ask your event organizer for the group code and tap the + button
                  to join.
                </Text>
                <Pressable
                  onPress={openJoinModal}
                  style={({ pressed }) => [
                    styles.joinButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Plus size={18} strokeWidth={2.4} color="#ffffff" />
                  <Text style={styles.joinButtonText}>Join a Group</Text>
                </Pressable>
              </View>
            </View>
          )}

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
        </ScrollView>

        {showManifestList ? (
          <Pressable
            onPress={openJoinModal}
            style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          >
            <Plus size={28} strokeWidth={2.4} color="#ffffff" />
          </Pressable>
        ) : null}

        <BottomNavigation
          items={[
            {
              label: "Groups",
              icon: BookOpenText,
              active: activeTab === "Groups",
              onPress: () => setActiveTab("Groups"),
            },
            {
              label: "Permits",
              icon: FileText,
              active: activeTab === "Permits",
              onPress: () => setActiveTab("Permits"),
            },
            {
              label: "Profile",
              icon: UserRound,
              active: activeTab === "Profile",
              onPress: () => setActiveTab("Profile"),
            },
          ]}
        />

        {isPreviewOpen ? (
          <View style={styles.modalBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setIsPreviewOpen(false)}
            />
            <View style={styles.previewCard}>
              <ScrollView
                contentContainerStyle={styles.previewScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.modalSearchArea}>
                  <Text style={styles.modalTitle}>Join a Group</Text>
                  <Text style={styles.modalText}>
                    Enter the room code provided by your organizer.
                  </Text>
                  <View style={styles.searchRow}>
                    <View style={styles.searchField}>
                      <Search size={18} strokeWidth={2} color="#7a9477" />
                      <TextInput
                        value={roomCode}
                        onChangeText={(value) => {
                          setRoomCode(value);
                          setStatusMessage("");
                        }}
                        placeholder="FS3M7"
                        placeholderTextColor="#97a38f"
                        autoCapitalize="characters"
                        autoCorrect={false}
                        style={styles.searchInput}
                      />
                    </View>
                    <Pressable
                      onPress={() => void lookupManifest()}
                      disabled={isSearching}
                      style={({ pressed }) => [
                        styles.searchButton,
                        (pressed || isSearching) && styles.pressed,
                      ]}
                    >
                      <Search size={20} strokeWidth={2.4} color="#ffffff" />
                    </Pressable>
                  </View>
                </View>

                {preview ? (
                  <View style={styles.previewBody}>
                    <View style={styles.previewHero}>
                      <View style={styles.previewHeroOverlay} />
                      <View style={styles.previewHeroIconWrap}>
                        <Mountain size={34} strokeWidth={2.1} color="#f2f7ee" />
                      </View>
                      <Text style={styles.previewBadge}>Event Group Code</Text>
                      <Text style={styles.previewCode}>
                        {preview.manifest_room_code}
                      </Text>
                    </View>

                    <Text style={styles.previewTitle}>
                      {preview.trail_name ?? "Isarog Summit Assault 2026"}
                    </Text>
                    <Text style={styles.previewSubtitle}>
                      {preview.organizer_name ?? "Kaibigan ng Kalikasan"}
                    </Text>
                    <Text style={styles.previewDescription}>
                      {preview.description ??
                        "A 2-day summit assault to Mt. Isarog, home of endemic species and rich biodiversity in Camarines Sur."}
                    </Text>

                    <View style={styles.detailGrid}>
                      <DetailBlock
                        icon={<MapPin size={16} strokeWidth={2} color="#2f6f32" />}
                        label="Mountain"
                        value={preview.mountain_name ?? "Mt. Isarog"}
                      />
                      <DetailBlock
                        icon={<CalendarDays size={16} strokeWidth={2} color="#2f6f32" />}
                        label="Date"
                        value={formatPreviewDate(preview.climb_date)}
                      />
                      <DetailBlock
                        icon={<Users size={16} strokeWidth={2} color="#2f6f32" />}
                        label="Slots"
                        value={formatPreviewSlots(preview)}
                      />
                      <DetailBlock
                        icon={<FileText size={16} strokeWidth={2} color="#2f6f32" />}
                        label="Province"
                        value={preview.location_description ?? "Camarines Sur"}
                      />
                    </View>

                    <Pressable
                      onPress={() => void handleJoinGroup(preview.manifest_room_code)}
                      disabled={isJoining}
                      style={({ pressed }) => [
                        styles.previewJoinButton,
                        (pressed || isJoining) && styles.pressed,
                      ]}
                    >
                      <Text style={styles.previewJoinButtonText}>
                        {isJoining ? "Joining..." : "Join Group"}
                      </Text>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.previewEmptyState}>
                    <View style={styles.emptyIconWrap}>
                      <Mountain size={34} strokeWidth={2.1} color="#2f6f32" />
                    </View>
                    <Text style={styles.previewEmptyTitle}>Search a manifest</Text>
                    <Text style={styles.previewEmptyText}>
                      Enter a room code to view the manifest details before joining.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function formatPreviewDate(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "Jun 21, 2026";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "Jun 21, 2026";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function DetailBlock({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailGrid}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailTextWrap}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function formatManifestDate(dateValue: string | null) {
  return formatPreviewDate(dateValue);
}

function formatPreviewSlots(preview: LookupManifest | null) {
  if (!preview) {
    return "16/20";
  }

  const total = preview.capacity_total ?? preview.daily_carrying_capacity;
  const used = preview.joined_count ?? preview.capacity_used ?? 0;
  if (!total || total <= 0) {
    return `${used}/--`;
  }

  return `${used}/${total}`;
}

function buildManifestDescription(group: JoinedGroup) {
  const trail = group.trail_name ?? "the trail";
  const mountain = group.mountain_name ?? "the mountain";
  const organizer = group.organizer_name ?? "your organizer";

  return `A guided expedition to ${trail} on ${mountain}, organized by ${organizer}.`;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f5f2ed",
  },
  shell: {
    flex: 1,
    backgroundColor: "#f5f2ed",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#f5f2ed",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#17311d",
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 22,
  },
  identityCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandKicker: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  displayName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    lineHeight: 24,
  },
  groupCount: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  searchSection: {
    gap: 16,
  },
  searchHeader: {
    gap: 10,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
  },
  searchField: {
    flex: 1,
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    color: "#243524",
    fontSize: 15,
    fontWeight: "700",
    paddingVertical: 0,
  },
  searchButton: {
    width: 58,
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#2f6f32",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionEyebrow: {
    color: "#7a9477",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  emptyCard: {
    borderRadius: 26,
    padding: 28,
    backgroundColor: "#f4efe6",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    alignItems: "center",
    gap: 14,
    marginTop: 6,
    minHeight: 600,
    justifyContent: "center",
  },
  emptyIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7f2e8",
  },
  emptyTitle: {
    color: "#243524",
    fontSize: 22,
    fontWeight: "900",
  },
  emptyText: {
    color: "#6e7d69",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 260,
  },
  joinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    backgroundColor: "#2f6f32",
    paddingHorizontal: 22,
    paddingVertical: 14,
  },
  joinButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  statusText: {
    color: "#6e7d69",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 2,
  },
  listSection: {
    gap: 12,
  },
  listHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: "#243524",
    fontSize: 28,
    fontWeight: "900",
    lineHeight: 30,
  },
  sectionSubtitle: {
    color: "#6b7a68",
    fontSize: 13,
    lineHeight: 20,
  },
  manifestList: {
    gap: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#2f6f32",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  modalBackdrop: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(17,17,17,0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  previewCard: {
    width: "100%",
    maxWidth: 390,
    maxHeight: "88%",
    borderRadius: 28,
    overflow: "hidden",
    backgroundColor: "#f5f2ed",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
  },
  previewScrollContent: {
    flexGrow: 1,
  },
  previewHero: {
    minHeight: 160,
    padding: 16,
    justifyContent: "flex-end",
    backgroundColor: "#3f7f3f",
  },
  previewHeroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(44, 96, 44, 0.48)",
  },
  previewHeroIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 12,
  },
  previewBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#f2f7ee",
    fontSize: 10,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  previewCode: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 6,
  },
  previewBody: {
    padding: 16,
    gap: 12,
  },
  modalSearchArea: {
    padding: 16,
    gap: 10,
  },
  modalTitle: {
    color: "#243524",
    fontSize: 24,
    fontWeight: "900",
  },
  modalText: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  previewTitle: {
    color: "#243524",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  previewSubtitle: {
    color: "#6b7a68",
    fontSize: 13,
    fontWeight: "700",
  },
  previewDescription: {
    color: "#6b7a68",
    fontSize: 13,
    lineHeight: 19,
  },
  detailGrid: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#faf8f2",
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e7f2e8",
    alignItems: "center",
    justifyContent: "center",
  },
  detailTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  detailLabel: {
    color: "#7a9477",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  detailValue: {
    color: "#243524",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  previewJoinButton: {
    borderRadius: 16,
    backgroundColor: "#2f6f32",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previewJoinButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  previewEmptyState: {
    alignItems: "center",
    gap: 10,
    height: 400,
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  previewEmptyTitle: {
    color: "#243524",
    fontSize: 18,
    fontWeight: "900",
  },
  previewEmptyText: {
    color: "#6b7a68",
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
});
