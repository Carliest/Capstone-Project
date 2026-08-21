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
import {
  SESSION_STORAGE_KEY,
  deleteStoredValue,
  readStoredValue,
} from "../storage";
import { BottomNavigation } from "../components/BottomNavigation";

type GroupsPageProps = {
  onLogout: () => void;
};

type SessionPayload = {
  token: string;
  user?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
};

type JoinedGroup = {
  manifest_item_id: string;
  manifest_id: string;
  manifest_room_code: string;
  climb_date: string | null;
  booking_status: string;
  trail_name: string | null;
  trail_class: string | null;
  difficulty_rating: string | null;
  daily_carrying_capacity: number | null;
  current_trail_occupancy: number | null;
  mountain_name: string | null;
  location_description: string | null;
  organizer_name: string | null;
  guide_name: string | null;
  hiker_readiness_status: string;
  joined_at: string;
  joined_count: number;
};

type LookupManifest = {
  manifest_id: string;
  manifest_room_code: string;
  climb_date: string | null;
  booking_status: string;
  trail_id: string | null;
  trail_name: string | null;
  trail_class: string | null;
  difficulty_rating: string | null;
  daily_carrying_capacity: number | null;
  current_trail_occupancy: number | null;
  mountain_name: string | null;
  location_description: string | null;
  organizer_name: string | null;
  guide_name: string | null;
  capacity_total: number | null;
  capacity_used: number | null;
  description: string;
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

export function GroupsPage({ onLogout }: GroupsPageProps) {
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

  async function bootstrap() {
    if (!apiClient) {
      setStatusMessage(
        "Set EXPO_PUBLIC_API_URL to your Render backend URL before loading groups."
      );
      setIsLoadingGroups(false);
      return;
    }

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
      await loadGroups(parsed.token);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load your session."
      );
    } finally {
      setIsLoadingGroups(false);
    }
  }

  async function loadGroups(token: string) {
    const result = await apiClient!.get<GroupsResponse>("/api/manifests/mine", token);
    setGroups(result.groups);
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

    setIsSearching(true);
    setStatusMessage("");

    try {
      const result = await apiClient!.get<LookupResponse>(
        `/api/manifests/lookup?roomCode=${encodeURIComponent(code)}`,
        session.token
      );

      setPreview(result.manifest);
      setIsPreviewOpen(true);
    } catch (error) {
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

    setIsJoining(true);
    setStatusMessage("");

    try {
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
                  accessibilityLabel={`${displayName} profile initials`}
                >
                  <Text style={styles.avatarText}>{initials}</Text>
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
                    <View key={group.manifest_item_id} style={styles.manifestCard}>
                      <View style={styles.manifestHero}>
                        <View style={styles.manifestHeroOverlay} />
                        <View style={styles.manifestHeroIconWrap}>
                          <Mountain size={34} strokeWidth={2.1} color="#e8f1e4" />
                      </View>
                      <View style={styles.manifestHeroText}>
                        <Text style={styles.manifestStatusPill}>Upcoming</Text>
                        <Text style={styles.manifestTitle} numberOfLines={2}>
                          {group.trail_name ?? "Expedition Manifest"}
                        </Text>
                        <Text style={styles.manifestSubtitle} numberOfLines={1}>
                          {group.organizer_name ?? "Kaibigan ng Kalikasan"}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.manifestBody}>
                      <Text style={styles.manifestDescription} numberOfLines={2}>
                        {buildManifestDescription(group)}
                      </Text>

                      <View style={styles.detailGrid}>
                        <DetailBlock
                          icon={<MapPin size={16} strokeWidth={2} color="#2f6f32" />}
                          label="Mountain"
                          value={group.mountain_name ?? "Unknown"}
                        />
                        <DetailBlock
                          icon={<CalendarDays size={16} strokeWidth={2} color="#2f6f32" />}
                          label="Date"
                          value={formatManifestDate(group.climb_date)}
                        />
                        <DetailBlock
                          icon={<Users size={16} strokeWidth={2} color="#2f6f32" />}
                          label="Slots"
                          value={formatSlots(group)}
                        />
                        <DetailBlock
                          icon={<FileText size={16} strokeWidth={2} color="#2f6f32" />}
                          label="Province"
                          value={group.location_description ?? "Camarines Sur"}
                        />
                      </View>

                      <View style={styles.cardFooter}>
                        <Text style={styles.guideText}>
                          Guide: {group.guide_name ?? "Pending assignment"}
                        </Text>
                        <Pressable
                          onPress={() => setIsPreviewOpen(true)}
                          style={({ pressed }) => [
                            styles.streamButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <FileText size={14} strokeWidth={2} color="#2f6f32" />
                          <Text style={styles.streamText}>View stream</Text>
                        </Pressable>
                      </View>

                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${getOccupancyPercent(group)}%`,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.searchSection}>
              <View style={styles.searchHeader}>
                <Text style={styles.sectionEyebrow}>Event Group Code</Text>
                <View style={styles.searchRow}>
                  <View style={styles.searchField}>
                    <Search size={18} strokeWidth={2} color="#7a9477" />
                    <TextInput
                      value={roomCode}
                      onChangeText={(value) => {
                        setRoomCode(value);
                        setStatusMessage("");
                      }}
                      placeholder="KNK-2026-ISA"
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
                  onPress={() => {
                    if (roomCode.trim()) {
                      void lookupManifest();
                      return;
                    }

                    setIsPreviewOpen(true);
                  }}
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
            onPress={() => {
              setStatusMessage("");
              setIsPreviewOpen(true);
            }}
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
                      placeholder="KNK-2026-ISA"
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
                      <Mountain size={40} strokeWidth={2.1} color="#f2f7ee" />
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
            </View>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
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
    <View style={styles.detailBlock}>
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

function formatManifestDate(dateValue: string | null) {
  return formatPreviewDate(dateValue);
}

function formatSlots(group: JoinedGroup) {
  const used = group.current_trail_occupancy ?? group.joined_count ?? 0;
  const total = group.daily_carrying_capacity ?? 0;

  if (!total) {
    return `${used}/--`;
  }

  return `${used}/${total}`;
}

function formatPreviewSlots(preview: LookupManifest | null) {
  if (!preview) {
    return "16/20";
  }

  const total = preview.capacity_total ?? preview.daily_carrying_capacity;
  const used = preview.capacity_used ?? 0;
  if (!total || total <= 0) {
    return `${used}/--`;
  }

  return `${used}/${total}`;
}

function getOccupancyPercent(group: JoinedGroup) {
  const used = group.current_trail_occupancy ?? group.joined_count ?? 0;
  const total = group.daily_carrying_capacity ?? 0;

  if (!total) {
    return 26;
  }

  return Math.min(100, Math.max(12, Math.round((used / total) * 100)));
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
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
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
    minHeight: 320,
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
    gap: 14,
    paddingTop: 6,
    paddingBottom: 10,
  },
  manifestCard: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  manifestHero: {
    minHeight: 132,
    padding: 16,
    backgroundColor: "#2f6f32",
    justifyContent: "flex-end",
  },
  manifestHeroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(31, 78, 34, 0.52)",
  },
  manifestHeroIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 12,
  },
  manifestHeroText: {
    gap: 4,
  },
  manifestStatusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#f2f7ee",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  manifestTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 26,
  },
  manifestSubtitle: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    lineHeight: 18,
  },
  manifestBody: {
    padding: 16,
    gap: 14,
  },
  manifestDescription: {
    color: "#6e7d69",
    fontSize: 14,
    lineHeight: 20,
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailBlock: {
    width: "48%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#faf8f2",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  detailIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  detailValue: {
    color: "#243524",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  guideText: {
    color: "#4f5f4c",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  streamButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streamText: {
    color: "#2f6f32",
    fontSize: 12,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "#e8e4db",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2f6f32",
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
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "#f5f2ed",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
  },
  previewHero: {
    minHeight: 190,
    padding: 18,
    justifyContent: "flex-end",
    backgroundColor: "#3f7f3f",
  },
  previewHeroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(44, 96, 44, 0.48)",
  },
  previewHeroIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 16,
  },
  previewBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    color: "#f2f7ee",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
  },
  previewCode: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 8,
  },
  previewBody: {
    padding: 18,
    gap: 14,
  },
  modalSearchArea: {
    padding: 18,
    gap: 12,
  },
  modalTitle: {
    color: "#243524",
    fontSize: 26,
    fontWeight: "900",
  },
  modalText: {
    color: "#6b7a68",
    fontSize: 13,
    lineHeight: 20,
  },
  previewTitle: {
    color: "#243524",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 28,
  },
  previewSubtitle: {
    color: "#6b7a68",
    fontSize: 14,
    fontWeight: "700",
  },
  previewDescription: {
    color: "#6b7a68",
    fontSize: 14,
    lineHeight: 20,
  },
  previewJoinButton: {
    borderRadius: 18,
    backgroundColor: "#2f6f32",
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  previewJoinButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  previewEmptyState: {
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
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
