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
import type { ReactNode } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { ChevronRight, FileText, Mountain, Plus, Trash2 } from "lucide-react-native";
import { createApiClient } from "../api";
import { SyncStatusBanner } from "../components/SyncStatusBanner";
import { SESSION_STORAGE_KEY, deleteStoredValue, readStoredValue } from "../storage";
import { useBackendSyncStatus } from "../hooks/useBackendSyncStatus";

type ManagementWorkspaceProps = {
  mode: "organizer" | "lgu_official";
  onLogout: () => void;
};

type SessionPayload = {
  token: string;
  user?: {
    user_id?: string;
    role?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
  };
};

type TrailOption = {
  trail_id: string;
  trail_name: string | null;
  mountain_name: string | null;
  difficulty_rating: string | null;
  daily_carrying_capacity: number | null;
  current_trail_occupancy: number | null;
};

type ManifestTemplate = {
  document_type_id: string;
  manifest_id: string;
  created_by_organizer_id: string;
  document_name: string;
  description: string | null;
  is_required: boolean;
  created_at: string;
};

type TrailMaterial = {
  trail_material_id: string;
  trail_id: string | null;
  manifest_id: string | null;
  lgu_official_id: string;
  title: string;
  material_type: "video" | "pdf" | "file" | "link" | string;
  resource_url: string | null;
  description: string | null;
  created_at: string;
};

type ManifestCreateResponse = {
  roomCode: string;
  manifest: {
    manifest_id: string;
    manifest_room_code: string;
    trail_id: string;
    climb_date: string;
  };
};

type TemplatesResponse = {
  documentTypes: ManifestTemplate[];
  count: number;
};

type TrailsResponse = {
  trails?: TrailOption[];
  availableTrails?: TrailOption[];
  count: number;
};

type TrailMaterialsResponse = {
  trailMaterials: TrailMaterial[];
  count: number;
};

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
const apiClient = apiBaseUrl ? createApiClient(apiBaseUrl) : null;

export function ManagementWorkspaceScreen({
  mode,
  onLogout,
}: ManagementWorkspaceProps) {
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeSyncOperations, setActiveSyncOperations] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const backendSync = useBackendSyncStatus(apiBaseUrl);

  const [trails, setTrails] = useState<TrailOption[]>([]);
  const [selectedTrailId, setSelectedTrailId] = useState("");
  const [selectedManifestId, setSelectedManifestId] = useState("");
  const [createdRoom, setCreatedRoom] = useState<ManifestCreateResponse | null>(null);

  const [climbDate, setClimbDate] = useState("");
  const [isCreatingManifest, setIsCreatingManifest] = useState(false);
  const [templates, setTemplates] = useState<ManifestTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  const [materials, setMaterials] = useState<TrailMaterial[]>([]);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialType, setMaterialType] = useState<TrailMaterial["material_type"]>("pdf");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materialFileName, setMaterialFileName] = useState("");
  const [materialDescription, setMaterialDescription] = useState("");
  const [isSavingMaterial, setIsSavingMaterial] = useState(false);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
  const [isPickingMaterialFile, setIsPickingMaterialFile] = useState(false);

  const isSyncing = activeSyncOperations > 0;
  const isOrganizerMode = mode === "organizer";
  const safeTrails = Array.isArray(trails) ? trails : [];

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (isOrganizerMode && selectedManifestId) {
      void loadTemplates(selectedManifestId);
    }
  }, [isOrganizerMode, selectedManifestId]);

  useEffect(() => {
    if (!isOrganizerMode && selectedTrailId) {
      void loadMaterials(selectedTrailId);
    }
  }, [isOrganizerMode, selectedTrailId]);

  const selectedTrail = useMemo(
    () => safeTrails.find((trail) => trail.trail_id === selectedTrailId) ?? null,
    [safeTrails, selectedTrailId]
  );

  const screenTitle = isOrganizerMode
    ? "Organizer Control Room"
    : "LGU Materials Studio";
  const screenSubtitle = isOrganizerMode
    ? "Create expedition rooms and attach room-specific compliance templates."
    : "Publish trail materials for trails your LGU maintains.";

  async function bootstrap() {
    if (!apiClient) {
      setStatusMessage("Set EXPO_PUBLIC_API_URL to your backend URL before continuing.");
      setIsLoading(false);
      return;
    }

    const storedSession = await readStoredValue(SESSION_STORAGE_KEY);
    if (!storedSession) {
      setStatusMessage("Please log in again.");
      setIsLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(storedSession) as SessionPayload;
      if (!parsed?.token) {
        throw new Error("Session token is missing.");
      }

      setSession(parsed);
      if (isOrganizerMode) {
        await loadTrailsForOrganizer(parsed.token);
      } else {
        await loadTrailsForLgu(parsed.token);
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to load workspace.");
    } finally {
      setIsLoading(false);
    }
  }

  async function runWithSyncTracking<T>(task: () => Promise<T>) {
    setActiveSyncOperations((current) => current + 1);
    try {
      return await task();
    } finally {
      setActiveSyncOperations((current) => Math.max(0, current - 1));
    }
  }

  async function loadTrailsForOrganizer(token: string) {
    await runWithSyncTracking(async () => {
      const result = await apiClient!.get<TrailsResponse>("/api/manifests/available-trails", token);
      const normalizedTrails = result.availableTrails ?? result.trails ?? [];
      setTrails(normalizedTrails);
      if (!selectedTrailId && normalizedTrails.length > 0) {
        setSelectedTrailId(normalizedTrails[0].trail_id);
      }
      setLastSyncedAt(Date.now());
    });
  }

  async function loadTrailsForLgu(token: string) {
    await runWithSyncTracking(async () => {
      const result = await apiClient!.get<TrailsResponse>("/api/lgu/trails", token);
      const normalizedTrails = result.trails ?? result.availableTrails ?? [];
      setTrails(normalizedTrails);
      if (!selectedTrailId && normalizedTrails.length > 0) {
        setSelectedTrailId(normalizedTrails[0].trail_id);
      }
      setLastSyncedAt(Date.now());
    });
  }

  async function loadTemplates(manifestId: string) {
    if (!session?.token) {
      return;
    }

    setIsLoadingTemplates(true);
    try {
      const result = await apiClient!.get<TemplatesResponse>(
        `/api/compliance/document-types?manifestId=${encodeURIComponent(manifestId)}`,
        session.token
      );
      setTemplates(result.documentTypes);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load compliance templates."
      );
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }

  async function loadMaterials(trailId: string) {
    if (!session?.token) {
      return;
    }

    setIsLoadingMaterials(true);
    try {
      const result = await apiClient!.get<TrailMaterialsResponse>(
        `/api/lgu/trails/${encodeURIComponent(trailId)}/materials`,
        session.token
      );
      setMaterials(result.trailMaterials);
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to load trail materials."
      );
      setMaterials([]);
    } finally {
      setIsLoadingMaterials(false);
    }
  }

  async function handleCreateManifest() {
    if (!session?.token || !selectedTrailId || !climbDate.trim()) {
      setStatusMessage("Please choose a trail and climb date.");
      return;
    }

    setIsCreatingManifest(true);
    setStatusMessage("");
    try {
      const result = await runWithSyncTracking(async () => {
        return apiClient!.post<ManifestCreateResponse>(
          "/api/manifests/create",
          { trailId: selectedTrailId, climbDate: climbDate.trim() },
          session.token
        );
      });

      setCreatedRoom(result);
      setSelectedManifestId(result.manifest.manifest_id);
      setStatusMessage(
        `Room created. Share room code ${result.roomCode} and use manifest ${result.manifest.manifest_id} for compliance templates.`
      );
      setLastSyncedAt(Date.now());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to create room.");
    } finally {
      setIsCreatingManifest(false);
    }
  }

  async function handleCreateTemplate() {
    if (!session?.token || !selectedManifestId.trim() || !templateName.trim()) {
      setStatusMessage("Please enter a manifest ID and template name.");
      return;
    }

    setIsSavingTemplate(true);
    setStatusMessage("");
    try {
      await runWithSyncTracking(async () => {
        await apiClient!.post(
          "/api/compliance/document-types",
          {
            manifestId: selectedManifestId.trim(),
            documentName: templateName.trim(),
            description: templateDescription.trim() || undefined,
            isRequired,
          },
          session.token
        );
      });

      setTemplateName("");
      setTemplateDescription("");
      setIsRequired(true);
      await loadTemplates(selectedManifestId.trim());
      setStatusMessage("Compliance template saved for this room.");
      setLastSyncedAt(Date.now());
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to save compliance template."
      );
    } finally {
      setIsSavingTemplate(false);
    }
  }

  async function handleCreateMaterial() {
    if (!session?.token || !selectedTrailId.trim() || !materialTitle.trim()) {
      setStatusMessage("Please choose a trail and enter a title.");
      return;
    }

    if (materialType === "link" && !materialUrl.trim()) {
      setStatusMessage("Please enter a resource URL.");
      return;
    }

    if (materialType !== "link" && !materialUrl.trim()) {
      setStatusMessage("Please pick a file from the device for this material.");
      return;
    }

    setIsSavingMaterial(true);
    setStatusMessage("");
    try {
      await runWithSyncTracking(async () => {
        await apiClient!.post(
          `/api/lgu/trails/${encodeURIComponent(selectedTrailId.trim())}/materials`,
          {
            title: materialTitle.trim(),
            materialType,
            resourceUrl: materialUrl.trim() || undefined,
            description: materialDescription.trim() || undefined,
          },
          session.token
        );
      });

      setMaterialTitle("");
      setMaterialUrl("");
      setMaterialDescription("");
      await loadMaterials(selectedTrailId.trim());
      setStatusMessage("Trail material saved and ready for every room on this trail.");
      setLastSyncedAt(Date.now());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save material.");
    } finally {
      setIsSavingMaterial(false);
    }
  }

  async function handlePickMaterialFile() {
    if (!session?.token) {
      setStatusMessage("Please log in again.");
      return;
    }

    setIsPickingMaterialFile(true);
    setStatusMessage("");
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: true,
        base64: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        setStatusMessage("No file was selected.");
        return;
      }

      const base64Content =
        asset.base64 ??
        (await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        }));
      const mimeType = asset.mimeType ?? "application/octet-stream";
      setMaterialUrl(`data:${mimeType};base64,${base64Content}`);
      setMaterialFileName(asset.name ?? "Selected file");
      setStatusMessage(`Selected ${asset.name ?? "file"} from the device.`);
      setLastSyncedAt(Date.now());
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to pick file.");
    } finally {
      setIsPickingMaterialFile(false);
    }
  }

  async function handleLogout() {
    try {
      await deleteStoredValue(SESSION_STORAGE_KEY);
    } finally {
      onLogout();
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.shell}>
          <View style={styles.heroCard}>
            <View style={styles.headerRow}>
              <View style={styles.titleCopy}>
                <Text style={styles.kicker}>EcoTrail Bicol</Text>
                <Text style={styles.title}>{screenTitle}</Text>
                <Text style={styles.subtitle}>{screenSubtitle}</Text>
              </View>

              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [styles.logoutButton, pressed && styles.pressed]}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          </View>

          <SyncStatusBanner
            title={isOrganizerMode ? "organizer tools" : "lgu tools"}
            isOnline={backendSync.isOnline}
            isChecking={backendSync.isChecking}
            isSyncing={isSyncing}
            lastSyncedAt={lastSyncedAt}
          />

          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}

          {isLoading ? (
            <SectionCard title="Loading workspace" body="Pulling the latest data from the backend." />
          ) : isOrganizerMode ? (
            <>
              <SectionCard
                title="Create expedition room"
                body="Pick a trail, set the climb date, then create the manifest room."
              >
                <View style={styles.listStack}>
                  {trails.map((trail) => (
                    <Pressable
                      key={trail.trail_id}
                      onPress={() => setSelectedTrailId(trail.trail_id)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selectedTrailId === trail.trail_id && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                    >
                      <View style={styles.optionIcon}>
                        <Mountain size={16} color="#2f6f32" strokeWidth={2.2} />
                      </View>
                      <View style={styles.optionBody}>
                        <Text style={styles.optionTitle}>
                          {trail.trail_name ?? "Unnamed trail"}
                        </Text>
                        <Text style={styles.optionSubtitle}>
                          {(trail.mountain_name ?? "Unknown mountain") + " · " + (trail.difficulty_rating ?? "n/a")}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#7a9477" strokeWidth={2.2} />
                    </Pressable>
                  ))}
                </View>

                <Field label="Climb Date" value={climbDate} onChangeText={setClimbDate} placeholder="2026-08-27" />
                <Pressable
                  onPress={handleCreateManifest}
                  disabled={isCreatingManifest}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || isCreatingManifest) && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isCreatingManifest ? "Creating Room..." : "Create Room"}
                  </Text>
                </Pressable>
              </SectionCard>

              {createdRoom ? (
                <SectionCard
                  title="Room created"
                  body={`Room code ${createdRoom.roomCode} is ready. Use manifest ${createdRoom.manifest.manifest_id} to attach room templates.`}
                />
              ) : null}

              <SectionCard
                title="Compliance templates"
                body="Create the document requirements hikers must submit for this room."
              >
                <Field
                  label="Manifest ID"
                  value={selectedManifestId}
                  onChangeText={setSelectedManifestId}
                  placeholder="Paste the manifest ID here"
                />
                <Field
                  label="Template Name"
                  value={templateName}
                  onChangeText={setTemplateName}
                  placeholder="Medical Certificate"
                />
                <Field
                  label="Description"
                  value={templateDescription}
                  onChangeText={setTemplateDescription}
                  placeholder="Optional guidance for hikers"
                  multiline
                />

                <Pressable
                  onPress={() => setIsRequired((current) => !current)}
                  style={({ pressed }) => [
                    styles.checkRow,
                    pressed && styles.optionCardPressed,
                  ]}
                >
                  <View style={[styles.checkBox, isRequired && styles.checkBoxActive]} />
                  <Text style={styles.checkText}>Required document</Text>
                </Pressable>

                <Pressable
                  onPress={handleCreateTemplate}
                  disabled={isSavingTemplate}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    (pressed || isSavingTemplate) && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {isSavingTemplate ? "Saving..." : "Save Template"}
                  </Text>
                </Pressable>

                <Text style={styles.sectionLabel}>Current templates</Text>
                {isLoadingTemplates ? (
                  <Text style={styles.mutedText}>Loading templates...</Text>
                ) : templates.length > 0 ? (
                  <View style={styles.listStack}>
                    {templates.map((template) => (
                      <View key={template.document_type_id} style={styles.itemCard}>
                        <FileText size={16} color="#1f4e22" strokeWidth={2.2} />
                        <View style={styles.itemCopy}>
                          <Text style={styles.itemTitle}>{template.document_name}</Text>
                          <Text style={styles.itemBody}>
                            {template.is_required ? "Required" : "Optional"}
                            {template.description ? ` · ${template.description}` : ""}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.mutedText}>No templates saved yet.</Text>
                )}
              </SectionCard>
            </>
          ) : (
            <>
              <SectionCard
                title="Create trail materials"
                body="Publish pre-made LGU resources that every future room on the trail can inherit."
              >
                <View style={styles.listStack}>
                  {trails.map((trail) => (
                    <Pressable
                      key={trail.trail_id}
                      onPress={() => setSelectedTrailId(trail.trail_id)}
                      style={({ pressed }) => [
                        styles.optionCard,
                        selectedTrailId === trail.trail_id && styles.optionCardSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                    >
                      <View style={styles.optionIcon}>
                        <Mountain size={16} color="#2f6f32" strokeWidth={2.2} />
                      </View>
                      <View style={styles.optionBody}>
                        <Text style={styles.optionTitle}>
                          {trail.trail_name ?? "Unnamed trail"}
                        </Text>
                        <Text style={styles.optionSubtitle}>
                          {(trail.mountain_name ?? "Unknown mountain") + " · " + (trail.difficulty_rating ?? "n/a")}
                        </Text>
                      </View>
                      <ChevronRight size={16} color="#7a9477" strokeWidth={2.2} />
                    </Pressable>
                  ))}
                </View>

                <Field label="Material Title" value={materialTitle} onChangeText={setMaterialTitle} placeholder="Leave No Trace Guide" />
                {materialType === "link" ? (
                  <Field
                    label="Resource URL"
                    value={materialUrl}
                    onChangeText={setMaterialUrl}
                    placeholder="https://..."
                  />
                ) : (
                  <View style={styles.filePickerBlock}>
                    <Pressable
                      onPress={handlePickMaterialFile}
                      disabled={isPickingMaterialFile}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        (pressed || isPickingMaterialFile) && styles.buttonPressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {isPickingMaterialFile ? "Picking File..." : "Choose File From Device"}
                      </Text>
                    </Pressable>
                    <Text style={styles.mutedText}>
                      {materialFileName
                        ? `Selected file: ${materialFileName}`
                        : "No device file selected yet."}
                    </Text>
                  </View>
                )}
                <Field
                  label="Description"
                  value={materialDescription}
                  onChangeText={setMaterialDescription}
                  placeholder="Explain how hikers should use this material"
                  multiline
                />

                <View style={styles.typeRow}>
                  {(["video", "pdf", "file", "link"] as const).map((value) => (
                    <Pressable
                      key={value}
                      onPress={() => {
                        setMaterialType(value);
                        if (value === "link") {
                          setMaterialFileName("");
                        } else {
                          setMaterialUrl("");
                        }
                      }}
                      style={({ pressed }) => [
                        styles.typeChip,
                        materialType === value && styles.typeChipSelected,
                        pressed && styles.optionCardPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          materialType === value && styles.typeChipTextSelected,
                        ]}
                      >
                        {value.toUpperCase()}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Pressable
                  onPress={handleCreateMaterial}
                  disabled={isSavingMaterial}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    (pressed || isSavingMaterial) && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {isSavingMaterial ? "Saving..." : "Save Trail Material"}
                  </Text>
                </Pressable>
              </SectionCard>

              <SectionCard
                title="Current trail materials"
                body={selectedTrail ? `Materials for ${selectedTrail.trail_name ?? "this trail"}.` : "Select a trail to view materials."}
              >
                {isLoadingMaterials ? (
                  <Text style={styles.mutedText}>Loading trail materials...</Text>
                ) : materials.length > 0 ? (
                  <View style={styles.listStack}>
                    {materials.map((material) => (
                      <View key={material.trail_material_id} style={styles.itemCard}>
                        <FileText size={16} color="#1f4e22" strokeWidth={2.2} />
                        <View style={styles.itemCopy}>
                          <Text style={styles.itemTitle}>{material.title}</Text>
                          <Text style={styles.itemBody}>
                            {material.material_type.toUpperCase()}
                            {material.description ? ` · ${material.description}` : ""}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.mutedText}>No trail materials saved yet.</Text>
                )}
              </SectionCard>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionCard({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
      {children ? <View style={styles.cardChildren}>{children}</View> : null}
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#7a9477"
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#070e08",
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: "#070e08",
  },
  shell: {
    padding: 18,
    gap: 14,
  },
  heroCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "#0a1710",
    borderWidth: 1,
    borderColor: "rgba(74, 158, 77, 0.12)",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    color: "#4a9e4d",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    lineHeight: 33,
    fontWeight: "900",
    marginTop: 4,
  },
  subtitle: {
    color: "#c4d3c0",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  logoutButton: {
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  logoutText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.85,
  },
  statusText: {
    color: "#b8d5b8",
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 2,
  },
  card: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#f5f2ed",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    gap: 6,
  },
  cardTitle: {
    color: "#243524",
    fontSize: 18,
    fontWeight: "900",
  },
  cardBody: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  cardChildren: {
    gap: 12,
    paddingTop: 10,
  },
  listStack: {
    gap: 10,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#ffffff",
  },
  optionCardSelected: {
    borderColor: "rgba(47,111,50,0.35)",
    backgroundColor: "#eef8ef",
  },
  optionCardPressed: {
    opacity: 0.9,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e7f2e8",
  },
  optionBody: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    color: "#243524",
    fontSize: 13,
    fontWeight: "900",
  },
  optionSubtitle: {
    color: "#6b7a68",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: "#6b7a68",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#ffffff",
    color: "#243524",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontWeight: "600",
  },
  inputMultiline: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  primaryButton: {
    borderRadius: 16,
    backgroundColor: "#2f6f32",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryButton: {
    borderRadius: 16,
    backgroundColor: "#17311d",
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  checkBox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#7a9477",
  },
  checkBoxActive: {
    backgroundColor: "#2f6f32",
    borderColor: "#2f6f32",
  },
  checkText: {
    color: "#243524",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionLabel: {
    color: "#6b7a68",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  mutedText: {
    color: "#6b7a68",
    fontSize: 12,
    lineHeight: 18,
  },
  itemCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemTitle: {
    color: "#243524",
    fontSize: 13,
    fontWeight: "900",
  },
  itemBody: {
    color: "#6b7a68",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filePickerBlock: {
    gap: 8,
  },
  typeChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(44,80,40,0.08)",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeChipSelected: {
    borderColor: "#2f6f32",
    backgroundColor: "#eef8ef",
  },
  typeChipText: {
    color: "#6b7a68",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  typeChipTextSelected: {
    color: "#2f6f32",
  },
});
