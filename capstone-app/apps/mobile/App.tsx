import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  API_BASE_URL_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  deleteStoredValue,
  readStoredValue,
  writeStoredValue,
} from "./src/storage";
import { createApiClient, normalizeApiBaseUrl } from "./src/api";

type UserRole = "hiker" | "organizer" | "lgu_official" | "guide";
type ScreenKey =
  | "overview"
  | "manifests"
  | "tracking"
  | "compliance"
  | "announcements"
  | "lgu"
  | "settings";

type Session = {
  token: string;
  user: {
    user_id: string;
    email: string;
    role: UserRole;
    first_name: string;
    last_name: string;
    address: string;
    profile_picture: string | null;
  };
};

type Trail = {
  trail_id?: string;
  trail_name?: string;
  mountain_name?: string;
  active_safety_status?: string;
  daily_carrying_capacity?: number;
  current_trail_occupancy?: number;
  [key: string]: unknown;
};

type Mountain = {
  mountain_id?: string;
  mountain_name?: string;
  location_description?: string | null;
  [key: string]: unknown;
};

type Announcement = {
  announcement_id?: string;
  title?: string;
  content?: string;
  created_at?: string;
  [key: string]: unknown;
};

type DocumentType = {
  document_type_id?: string;
  document_name?: string;
  description?: string | null;
  is_required?: boolean;
};

type Guide = {
  guide_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  availability_status?: string;
  [key: string]: unknown;
};

type CheckpointStation = {
  checkpoint_id?: string;
  checkpoint_name?: string;
  trail_id?: string;
  sequence_number?: number;
};

const FALLBACK_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || "https://capstone-api.onrender.com";

const initialAuthForm = {
  email: "",
  password: "",
  role: "hiker" as Extract<UserRole, "hiker" | "organizer">,
  firstName: "",
  lastName: "",
  address: "",
};

const initialAccessRequestForm = {
  email: "",
  lguName: "",
  province: "",
  municipalityCity: "",
  officeName: "",
  contactPerson: "",
  contactNumber: "",
  officeAddress: "",
  message: "",
};

const initialManifestForm = {
  trailId: "",
  climbDate: "",
  roomCode: "",
};

const initialTrackingForms = {
  checkpoint: {
    manifestId: "",
    checkpointId: "",
  },
  hazard: {
    trailId: "",
    incidentType: "blockage",
    description: "",
    latitude: "",
    longitude: "",
    imageProofUrl: "",
  },
  sos: {
    manifestId: "",
    latitude: "",
    longitude: "",
    emergencyDetails: "",
  },
};

const initialComplianceForms = {
  upload: {
    manifestItemId: "",
    documentTypeId: "",
    uploadedFileUrl: "",
  },
  documentType: {
    documentName: "",
    description: "",
    isRequired: "true",
  },
  verify: {
    documentId: "",
    verificationStatus: "pending_review",
  },
};

const initialAnnouncementForm = {
  manifestId: "",
  title: "",
  content: "",
};

const initialLguForms = {
  mountain: {
    mountainName: "",
    locationDescription: "",
  },
  trail: {
    mountainId: "",
    trailName: "",
    trailClass: "class_1",
    difficultyRating: "easy",
    latitude: "",
    longitude: "",
    dailyCarryingCapacity: "",
    activeSafetyStatus: "open",
    currentTrailOccupancy: "0",
  },
  checkpointStation: {
    trailId: "",
    checkpointName: "",
    sequenceNumber: "",
  },
  guide: {
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    licenseNumber: "",
    contactNumber: "",
    availabilityStatus: "available",
  },
  approveManifest: {
    manifestId: "",
    guideId: "",
  },
  issuePermit: {
    manifestId: "",
    userId: "",
  },
};

function getDefaultApiBaseUrl() {
  return normalizeApiBaseUrl(FALLBACK_BASE_URL);
}

function safeJsonParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function asNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState(getDefaultApiBaseUrl());
  const [screen, setScreen] = useState<ScreenKey>("overview");
  const [statusMessage, setStatusMessage] = useState(
    "Connect your backend, then sign in to continue."
  );
  const [loading, setLoading] = useState(false);

  const [authForm, setAuthForm] = useState(initialAuthForm);
  const [accessRequestForm, setAccessRequestForm] = useState(
    initialAccessRequestForm
  );
  const [manifestForm, setManifestForm] = useState(initialManifestForm);
  const [trackingForms, setTrackingForms] = useState(initialTrackingForms);
  const [complianceForms, setComplianceForms] = useState(
    initialComplianceForms
  );
  const [announcementForm, setAnnouncementForm] = useState(
    initialAnnouncementForm
  );
  const [lguForms, setLguForms] = useState(initialLguForms);

  const [availableTrails, setAvailableTrails] = useState<Trail[]>([]);
  const [availableMountains, setAvailableMountains] = useState<Mountain[]>([]);
  const [allTrails, setAllTrails] = useState<Trail[]>([]);
  const [allMountains, setAllMountains] = useState<Mountain[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [checkpointStations, setCheckpointStations] = useState<
    CheckpointStation[]
  >([]);
  const [guides, setGuides] = useState<Guide[]>([]);

  const client = useMemo(() => createApiClient(apiBaseUrl), [apiBaseUrl]);

  const isAuthed = Boolean(session);
  const role = session?.user.role;
  const isOrganizer = role === "organizer";
  const isHiker = role === "hiker";
  const isLgu = role === "lgu_official";

  const tabs = useMemo(() => {
    const baseTabs: Array<{ key: ScreenKey; label: string }> = [
      { key: "overview", label: "Overview" },
      { key: "manifests", label: "Manifests" },
      { key: "tracking", label: "Tracking" },
      { key: "compliance", label: "Compliance" },
      { key: "announcements", label: "News" },
      { key: "settings", label: "Settings" },
    ];

    if (isLgu) {
      baseTabs.splice(5, 0, { key: "lgu", label: "LGU" });
    }

    return baseTabs;
  }, [isLgu]);

  useEffect(() => {
    let active = true;

    (async () => {
      const [storedSession, storedApiUrl] = await Promise.all([
        readStoredValue(SESSION_STORAGE_KEY),
        readStoredValue(API_BASE_URL_STORAGE_KEY),
      ]);

      if (!active) {
        return;
      }

      const parsedSession = safeJsonParse<Session>(storedSession);
      if (parsedSession?.token && parsedSession.user?.role) {
        setSession(parsedSession);
      }

      if (storedApiUrl) {
        setApiBaseUrl(normalizeApiBaseUrl(storedApiUrl));
      }

      setReady(true);
    })().catch((error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Failed to load app state";
      setStatusMessage(message);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }

    void writeStoredValue(API_BASE_URL_STORAGE_KEY, apiBaseUrl);
  }, [apiBaseUrl, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    if (session) {
      void writeStoredValue(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      void deleteStoredValue(SESSION_STORAGE_KEY);
    }
  }, [ready, session]);

  useEffect(() => {
    if (!ready || !apiBaseUrl) {
      return;
    }

    void refreshData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, apiBaseUrl]);

  useEffect(() => {
    if (!tabs.some((tab) => tab.key === screen)) {
      setScreen("overview");
    }
  }, [screen, tabs]);

  async function refreshData() {
    try {
      const publicAnnouncements = await client.get<{
        announcements: Announcement[];
      }>("/api/announcements");
      setAnnouncements(publicAnnouncements.announcements ?? []);

      if (!session) {
        setAvailableTrails([]);
        setAvailableMountains([]);
        setAllTrails([]);
        setAllMountains([]);
        setDocumentTypes([]);
        setCheckpointStations([]);
        setGuides([]);
        return;
      }

      const [openTrails, mountains] = await Promise.all([
        client.get<{ availableTrails: Trail[] }>(
          "/api/manifests/available-trails",
          session.token
        ),
        client.get<{ mountains: Mountain[] }>(
          "/api/manifests/available-mountains",
          session.token
        ),
      ]);

      setAvailableTrails(openTrails.availableTrails ?? []);
      setAvailableMountains(mountains.mountains ?? []);

      if (isLgu) {
        const [lguTrailsResponse, lguMountainsResponse, checkpointResponse, guidesResponse, documentTypesResponse] =
          await Promise.all([
            client.get<{ trails: Trail[] }>("/api/lgu/trails", session.token),
            client.get<{ mountains: Mountain[] }>(
              "/api/lgu/mountains",
              session.token
            ),
            client.get<{ checkpointStations: CheckpointStation[] }>(
              "/api/lgu/checkpoint-stations",
              session.token
            ),
            client.get<{ guides: Guide[] }>("/api/lgu/guides", session.token),
            client.get<{ documentTypes: DocumentType[] }>(
              "/api/compliance/document-types",
              session.token
            ),
          ]);

        setAllTrails(lguTrailsResponse.trails ?? []);
        setAllMountains(lguMountainsResponse.mountains ?? []);
        setCheckpointStations(checkpointResponse.checkpointStations ?? []);
        setGuides(guidesResponse.guides ?? []);
        setDocumentTypes(documentTypesResponse.documentTypes ?? []);
      } else {
        setAllTrails([]);
        setAllMountains([]);
        setCheckpointStations([]);
        setGuides([]);

        if (isHiker) {
          const documentTypesResponse = await client.get<{
            documentTypes: DocumentType[];
          }>("/api/compliance/document-types", session.token);
          setDocumentTypes(documentTypesResponse.documentTypes ?? []);
        } else {
          setDocumentTypes([]);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to refresh data";
      setStatusMessage(message);
      if (session) {
        Alert.alert("Refresh failed", message);
      }
    }
  }

  async function handleAuth(mode: "login" | "register") {
    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";

    if (!authForm.email.trim() || !authForm.password) {
      Alert.alert("Missing fields", "Email and password are required.");
      return;
    }

    if (mode === "register") {
      if (
        !authForm.firstName.trim() ||
        !authForm.lastName.trim() ||
        !authForm.address.trim()
      ) {
        Alert.alert(
          "Missing fields",
          "First name, last name, and address are required."
        );
        return;
      }
    }

    setLoading(true);
    try {
      const payload =
        mode === "login"
          ? {
              email: authForm.email.trim(),
              password: authForm.password,
            }
          : {
              email: authForm.email.trim(),
              password: authForm.password,
              role: authForm.role,
              firstName: authForm.firstName.trim(),
              lastName: authForm.lastName.trim(),
              address: authForm.address.trim(),
            };

      const data = await client.post<{
        token: string;
        user: Session["user"];
      }>(endpoint, payload);

      const nextSession: Session = {
        token: data.token,
        user: data.user,
      };

      setSession(nextSession);
      setScreen("overview");
      setStatusMessage(`Signed in as ${nextSession.user.first_name}.`);
      setAuthForm(initialAuthForm);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Authentication failed";
      Alert.alert("Auth failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function submitAccessRequest() {
    if (
      !accessRequestForm.email.trim() ||
      !accessRequestForm.lguName.trim()
    ) {
      Alert.alert("Missing fields", "Email and LGU name are required.");
      return;
    }

    setLoading(true);
    try {
      await client.post("/api/lgu/access-requests", {
        email: accessRequestForm.email.trim(),
        lguName: accessRequestForm.lguName.trim(),
        province: accessRequestForm.province.trim() || undefined,
        municipalityCity: accessRequestForm.municipalityCity.trim() || undefined,
        officeName: accessRequestForm.officeName.trim() || undefined,
        contactPerson: accessRequestForm.contactPerson.trim() || undefined,
        contactNumber: accessRequestForm.contactNumber.trim() || undefined,
        officeAddress: accessRequestForm.officeAddress.trim() || undefined,
        message: accessRequestForm.message.trim() || undefined,
      });
      Alert.alert(
        "Request submitted",
        "Your LGU access request was sent to the admin workflow."
      );
      setAccessRequestForm(initialAccessRequestForm);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit request";
      Alert.alert("Request failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setSession(null);
    setAvailableTrails([]);
    setAvailableMountains([]);
    setAllTrails([]);
    setAllMountains([]);
    setDocumentTypes([]);
    setCheckpointStations([]);
    setGuides([]);
    setStatusMessage("You have been logged out.");
  }

  async function createManifest() {
    if (!session || !isOrganizer) {
      return;
    }

    if (!manifestForm.trailId.trim() || !manifestForm.climbDate.trim()) {
      Alert.alert("Missing fields", "Trail ID and climb date are required.");
      return;
    }

    setLoading(true);
    try {
      const result = await client.post<{
        roomCode: string;
      }>(
        "/api/manifests/create",
        {
          trailId: manifestForm.trailId.trim(),
          climbDate: manifestForm.climbDate.trim(),
        },
        session.token
      );

      setManifestForm((current) => ({ ...current, roomCode: result.roomCode }));
      Alert.alert("Manifest created", `Room code: ${result.roomCode}`);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create manifest";
      Alert.alert("Create failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function joinManifest() {
    if (!session || !isHiker) {
      return;
    }

    if (!manifestForm.roomCode.trim()) {
      Alert.alert("Missing field", "Room code is required.");
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/manifests/join",
        { roomCode: manifestForm.roomCode.trim().toUpperCase() },
        session.token
      );
      Alert.alert("Joined", "You joined the manifest successfully.");
      setManifestForm(initialManifestForm);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to join manifest";
      Alert.alert("Join failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function logCheckpointPassage() {
    if (!session) {
      return;
    }

    if (
      !trackingForms.checkpoint.manifestId.trim() ||
      !trackingForms.checkpoint.checkpointId.trim()
    ) {
      Alert.alert("Missing fields", "Manifest ID and checkpoint ID are required.");
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/tracking/checkpoint-log",
        {
          manifestId: trackingForms.checkpoint.manifestId.trim(),
          checkpointId: trackingForms.checkpoint.checkpointId.trim(),
        },
        session.token
      );
      Alert.alert("Logged", "Checkpoint passage was recorded.");
      setTrackingForms((current) => ({
        ...current,
        checkpoint: { manifestId: "", checkpointId: "" },
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log checkpoint";
      Alert.alert("Checkpoint log failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createHazardLog() {
    if (!session) {
      return;
    }

    const latitude = asNumber(trackingForms.hazard.latitude);
    const longitude = asNumber(trackingForms.hazard.longitude);
    if (
      !trackingForms.hazard.trailId.trim() ||
      !trackingForms.hazard.description.trim() ||
      latitude === null ||
      longitude === null
    ) {
      Alert.alert(
        "Missing fields",
        "Trail ID, description, latitude, and longitude are required."
      );
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/tracking/hazard",
        {
          trailId: trackingForms.hazard.trailId.trim(),
          incidentType: trackingForms.hazard.incidentType,
          description: trackingForms.hazard.description.trim(),
          latitude,
          longitude,
          imageProofUrl: trackingForms.hazard.imageProofUrl.trim() || undefined,
        },
        session.token
      );
      Alert.alert("Reported", "Hazard report submitted.");
      setTrackingForms((current) => ({
        ...current,
        hazard: {
          trailId: "",
          incidentType: "blockage",
          description: "",
          latitude: "",
          longitude: "",
          imageProofUrl: "",
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to submit hazard";
      Alert.alert("Hazard failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createSosAlert() {
    if (!session) {
      return;
    }

    const latitude = asNumber(trackingForms.sos.latitude);
    const longitude = asNumber(trackingForms.sos.longitude);
    if (
      !trackingForms.sos.manifestId.trim() ||
      !trackingForms.sos.emergencyDetails.trim() ||
      latitude === null ||
      longitude === null
    ) {
      Alert.alert(
        "Missing fields",
        "Manifest ID, emergency details, latitude, and longitude are required."
      );
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/tracking/sos",
        {
          manifestId: trackingForms.sos.manifestId.trim(),
          latitude,
          longitude,
          emergencyDetails: trackingForms.sos.emergencyDetails.trim(),
        },
        session.token
      );
      Alert.alert("SOS sent", "Emergency alert was submitted.");
      setTrackingForms((current) => ({
        ...current,
        sos: {
          manifestId: "",
          latitude: "",
          longitude: "",
          emergencyDetails: "",
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send SOS";
      Alert.alert("SOS failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function submitComplianceUpload() {
    if (!session || !isHiker) {
      return;
    }

    if (
      !complianceForms.upload.manifestItemId.trim() ||
      !complianceForms.upload.documentTypeId.trim() ||
      !complianceForms.upload.uploadedFileUrl.trim()
    ) {
      Alert.alert(
        "Missing fields",
        "Manifest item ID, document type ID, and file URL are required."
      );
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/compliance/upload",
        {
          manifestItemId: complianceForms.upload.manifestItemId.trim(),
          documentTypeId: complianceForms.upload.documentTypeId.trim(),
          uploadedFileUrl: complianceForms.upload.uploadedFileUrl.trim(),
        },
        session.token
      );
      Alert.alert("Uploaded", "Compliance document submitted.");
      setComplianceForms((current) => ({
        ...current,
        upload: {
          manifestItemId: "",
          documentTypeId: "",
          uploadedFileUrl: "",
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to upload document";
      Alert.alert("Upload failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createDocumentType() {
    if (!session || !isLgu) {
      return;
    }

    if (!complianceForms.documentType.documentName.trim()) {
      Alert.alert("Missing fields", "Document name is required.");
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/compliance/document-types",
        {
          documentName: complianceForms.documentType.documentName.trim(),
          description: complianceForms.documentType.description.trim() || undefined,
          isRequired: complianceForms.documentType.isRequired === "true",
        },
        session.token
      );
      Alert.alert("Created", "Document type added.");
      setComplianceForms((current) => ({
        ...current,
        documentType: {
          documentName: "",
          description: "",
          isRequired: "true",
        },
      }));
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create document type";
      Alert.alert("Create failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyDocument() {
    if (!session || !isLgu) {
      return;
    }

    if (!complianceForms.verify.documentId.trim()) {
      Alert.alert("Missing fields", "Document ID is required.");
      return;
    }

    setLoading(true);
    try {
      await client.patch(
        "/api/compliance/verify",
        {
          documentId: complianceForms.verify.documentId.trim(),
          verificationStatus: complianceForms.verify.verificationStatus,
        },
        session.token
      );
      Alert.alert("Updated", "Compliance document status changed.");
      setComplianceForms((current) => ({
        ...current,
        verify: {
          documentId: "",
          verificationStatus: "pending_review",
        },
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to verify document";
      Alert.alert("Verify failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createAnnouncement() {
    if (!session) {
      return;
    }

    if (
      !announcementForm.manifestId.trim() ||
      !announcementForm.title.trim() ||
      !announcementForm.content.trim()
    ) {
      Alert.alert(
        "Missing fields",
        "Manifest ID, title, and content are required."
      );
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/announcements",
        {
          manifestId: announcementForm.manifestId.trim(),
          title: announcementForm.title.trim(),
          content: announcementForm.content.trim(),
        },
        session.token
      );
      Alert.alert("Posted", "Announcement published.");
      setAnnouncementForm(initialAnnouncementForm);
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create announcement";
      Alert.alert("Announcement failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createMountain() {
    if (!session || !isLgu) {
      return;
    }

    if (!lguForms.mountain.mountainName.trim()) {
      Alert.alert("Missing fields", "Mountain name is required.");
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/lgu/mountains",
        {
          mountainName: lguForms.mountain.mountainName.trim(),
          locationDescription: lguForms.mountain.locationDescription.trim() || undefined,
        },
        session.token
      );
      Alert.alert("Created", "Mountain added.");
      setLguForms((current) => ({
        ...current,
        mountain: { mountainName: "", locationDescription: "" },
      }));
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create mountain";
      Alert.alert("Mountain failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createTrail() {
    if (!session || !isLgu) {
      return;
    }

    const latitude = asNumber(lguForms.trail.latitude);
    const longitude = asNumber(lguForms.trail.longitude);
    const carryingCapacity = asNumber(lguForms.trail.dailyCarryingCapacity);
    const occupancy = asNumber(lguForms.trail.currentTrailOccupancy || "0");

    if (
      !lguForms.trail.mountainId.trim() ||
      !lguForms.trail.trailName.trim() ||
      latitude === null ||
      longitude === null ||
      carryingCapacity === null ||
      occupancy === null
    ) {
      Alert.alert(
        "Missing fields",
        "Mountain ID, trail name, coordinates, and carrying capacity are required."
      );
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/lgu/trails",
        {
          mountainId: lguForms.trail.mountainId.trim(),
          trailName: lguForms.trail.trailName.trim(),
          trailClass: lguForms.trail.trailClass,
          difficultyRating: lguForms.trail.difficultyRating,
          latitude,
          longitude,
          dailyCarryingCapacity: carryingCapacity,
          activeSafetyStatus: lguForms.trail.activeSafetyStatus,
          currentTrailOccupancy: occupancy,
        },
        session.token
      );
      Alert.alert("Created", "Trail added.");
      setLguForms((current) => ({
        ...current,
        trail: {
          mountainId: "",
          trailName: "",
          trailClass: "class_1",
          difficultyRating: "easy",
          latitude: "",
          longitude: "",
          dailyCarryingCapacity: "",
          activeSafetyStatus: "open",
          currentTrailOccupancy: "0",
        },
      }));
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create trail";
      Alert.alert("Trail failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createCheckpointStation() {
    if (!session || !isLgu) {
      return;
    }

    const sequenceNumber = asNumber(lguForms.checkpointStation.sequenceNumber);
    if (
      !lguForms.checkpointStation.trailId.trim() ||
      !lguForms.checkpointStation.checkpointName.trim() ||
      sequenceNumber === null
    ) {
      Alert.alert(
        "Missing fields",
        "Trail ID, checkpoint name, and sequence number are required."
      );
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/lgu/checkpoint-stations",
        {
          trailId: lguForms.checkpointStation.trailId.trim(),
          checkpointName: lguForms.checkpointStation.checkpointName.trim(),
          sequenceNumber,
        },
        session.token
      );
      Alert.alert("Created", "Checkpoint station added.");
      setLguForms((current) => ({
        ...current,
        checkpointStation: {
          trailId: "",
          checkpointName: "",
          sequenceNumber: "",
        },
      }));
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create checkpoint station";
      Alert.alert("Checkpoint failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function createGuide() {
    if (!session || !isLgu) {
      return;
    }

    if (
      !lguForms.guide.email.trim() ||
      !lguForms.guide.password ||
      !lguForms.guide.firstName.trim() ||
      !lguForms.guide.lastName.trim() ||
      !lguForms.guide.licenseNumber.trim() ||
      !lguForms.guide.contactNumber.trim()
    ) {
      Alert.alert("Missing fields", "Guide account fields are required.");
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/lgu/guides",
        {
          email: lguForms.guide.email.trim(),
          password: lguForms.guide.password,
          firstName: lguForms.guide.firstName.trim(),
          lastName: lguForms.guide.lastName.trim(),
          licenseNumber: lguForms.guide.licenseNumber.trim(),
          contactNumber: lguForms.guide.contactNumber.trim(),
          availabilityStatus: lguForms.guide.availabilityStatus,
        },
        session.token
      );
      Alert.alert("Created", "Guide account added.");
      setLguForms((current) => ({
        ...current,
        guide: {
          email: "",
          password: "",
          firstName: "",
          lastName: "",
          licenseNumber: "",
          contactNumber: "",
          availabilityStatus: "available",
        },
      }));
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create guide";
      Alert.alert("Guide failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function approveManifest() {
    if (!session || !isLgu) {
      return;
    }

    if (
      !lguForms.approveManifest.manifestId.trim() ||
      !lguForms.approveManifest.guideId.trim()
    ) {
      Alert.alert("Missing fields", "Manifest ID and guide ID are required.");
      return;
    }

    setLoading(true);
    try {
      await client.patch(
        `/api/lgu/manifests/${lguForms.approveManifest.manifestId.trim()}/approve`,
        { guideId: lguForms.approveManifest.guideId.trim() },
        session.token
      );
      Alert.alert("Approved", "Manifest approved.");
      setLguForms((current) => ({
        ...current,
        approveManifest: { manifestId: "", guideId: "" },
      }));
      await refreshData();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to approve manifest";
      Alert.alert("Approval failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function issuePermit() {
    if (!session || !isLgu) {
      return;
    }

    if (
      !lguForms.issuePermit.manifestId.trim() ||
      !lguForms.issuePermit.userId.trim()
    ) {
      Alert.alert("Missing fields", "Manifest ID and user ID are required.");
      return;
    }

    setLoading(true);
    try {
      await client.post(
        "/api/permits/issue",
        {
          manifestId: lguForms.issuePermit.manifestId.trim(),
          userId: lguForms.issuePermit.userId.trim(),
        },
        session.token
      );
      Alert.alert("Issued", "Digital permit issued.");
      setLguForms((current) => ({
        ...current,
        issuePermit: { manifestId: "", userId: "" },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to issue permit";
      Alert.alert("Permit failed", message);
    } finally {
      setLoading(false);
    }
  }

  async function saveApiUrl() {
    const normalized = normalizeApiBaseUrl(apiBaseUrl);
    if (!normalized) {
      Alert.alert("Missing URL", "Enter a backend API base URL first.");
      return;
    }

    setApiBaseUrl(normalized);
    setStatusMessage(`API URL saved: ${normalized}`);
    Alert.alert("Saved", "Backend URL updated.");
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.bootstrap}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color="#7ED8FF" />
        <Text style={styles.bootstrapText}>Preparing the mobile app...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <HeroCard
            session={session}
            apiBaseUrl={apiBaseUrl}
            statusMessage={statusMessage}
            onRefresh={refreshData}
            onLogout={handleLogout}
            loading={loading}
          />

          {!isAuthed ? (
            <>
              <AuthPanel
                authForm={authForm}
                setAuthForm={setAuthForm}
                apiBaseUrl={apiBaseUrl}
                setApiBaseUrl={setApiBaseUrl}
                onSaveApiUrl={() => void saveApiUrl()}
                onLogin={() => void handleAuth("login")}
                onRegister={() => void handleAuth("register")}
                loading={loading}
              />
              <AccessRequestPanel
                form={accessRequestForm}
                setForm={setAccessRequestForm}
                onSubmit={() => void submitAccessRequest()}
                loading={loading}
              />
            </>
          ) : (
            <>
              <NavBar tabs={tabs} active={screen} onChange={setScreen} />
              {screen === "overview" ? (
                <OverviewPanel
                  session={session}
                  availableTrails={availableTrails}
                  availableMountains={availableMountains}
                  announcements={announcements}
                  onRefresh={refreshData}
                  loading={loading}
                />
              ) : null}
              {screen === "manifests" ? (
                <ManifestPanel
                  session={session}
                  isOrganizer={isOrganizer}
                  isHiker={isHiker}
                  trails={availableTrails}
                  form={manifestForm}
                  setForm={setManifestForm}
                  onCreate={() => void createManifest()}
                  onJoin={() => void joinManifest()}
                  loading={loading}
                />
              ) : null}
              {screen === "tracking" ? (
                <TrackingPanel
                  session={session}
                  forms={trackingForms}
                  setForms={setTrackingForms}
                  onCheckpoint={() => void logCheckpointPassage()}
                  onHazard={() => void createHazardLog()}
                  onSos={() => void createSosAlert()}
                  loading={loading}
                />
              ) : null}
              {screen === "compliance" ? (
                <CompliancePanel
                  session={session}
                  isHiker={isHiker}
                  isLgu={isLgu}
                  forms={complianceForms}
                  setForms={setComplianceForms}
                  documentTypes={documentTypes}
                  onUpload={() => void submitComplianceUpload()}
                  onCreateType={() => void createDocumentType()}
                  onVerify={() => void verifyDocument()}
                  loading={loading}
                />
              ) : null}
              {screen === "announcements" ? (
                <AnnouncementsPanel
                  session={session}
                  announcements={announcements}
                  form={announcementForm}
                  setForm={setAnnouncementForm}
                  onCreate={() => void createAnnouncement()}
                  loading={loading}
                />
              ) : null}
              {screen === "lgu" && isLgu ? (
                <LguPanel
                  session={session}
                  mountains={allMountains}
                  trails={allTrails}
                  checkpointStations={checkpointStations}
                  guides={guides}
                  forms={lguForms}
                  setForms={setLguForms}
                  onCreateMountain={() => void createMountain()}
                  onCreateTrail={() => void createTrail()}
                  onCreateCheckpointStation={() => void createCheckpointStation()}
                  onCreateGuide={() => void createGuide()}
                  onApproveManifest={() => void approveManifest()}
                  onIssuePermit={() => void issuePermit()}
                  loading={loading}
                />
              ) : null}
              {screen === "settings" ? (
                <SettingsPanel
                  session={session}
                  apiBaseUrl={apiBaseUrl}
                  setApiBaseUrl={setApiBaseUrl}
                  onSaveApiUrl={() => void saveApiUrl()}
                  onLogout={handleLogout}
                />
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroCard(props: {
  session: Session | null;
  apiBaseUrl: string;
  statusMessage: string;
  onRefresh: () => Promise<void>;
  onLogout: () => Promise<void>;
  loading: boolean;
}) {
  const signedInRole = props.session?.user.role ?? "guest";
  const subtitle = props.session
    ? props.session.user.role === "organizer"
      ? "Organizers can manage manifests, trails, and trip coordination from the phone."
      : props.session.user.role === "lgu_official"
        ? "LGU officials can approve manifests, issue permits, and manage public trail data."
        : "Hikers can join manifests, report hazards, and keep safety tools close."
    : "A mobile control room for hikers, organizers, and LGU workflows.";

  return (
    <View style={styles.heroCard}>
      <Text style={styles.kicker}>Capstone Mobile</Text>
      <Text style={styles.title}>Field-ready expedition management</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.metaRow}>
        <MetaPill label="API" value={props.apiBaseUrl} />
        <MetaPill label="Role" value={signedInRole} />
      </View>
      <Text style={styles.heroNote}>{props.statusMessage}</Text>
      <View style={styles.heroActions}>
        <Pressable
          onPress={() => void props.onRefresh()}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>
            {props.loading ? "Refreshing..." : "Refresh"}
          </Text>
        </Pressable>
        {props.session ? (
          <Pressable
            onPress={() => void props.onLogout()}
            style={({ pressed }) => [styles.ghostButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.ghostButtonText}>Logout</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MetaPill(props: { label: string; value: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{props.label}</Text>
      <Text style={styles.pillValue}>{props.value}</Text>
    </View>
  );
}

function SectionCard(props: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.card}>
      {props.eyebrow ? <Text style={styles.sectionEyebrow}>{props.eyebrow}</Text> : null}
      <Text style={styles.cardTitle}>{props.title}</Text>
      <View style={styles.cardBody}>{props.children}</View>
    </View>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "numeric";
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
  numberOfLines?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor="#738B9D"
        keyboardType={props.keyboardType ?? "default"}
        secureTextEntry={props.secureTextEntry}
        autoCapitalize={props.autoCapitalize ?? "sentences"}
        multiline={props.multiline}
        numberOfLines={props.numberOfLines}
        style={[styles.input, props.multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function SelectableItem(props: {
  label: string;
  description?: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={props.onPress}
      style={[
        styles.selectableItem,
        props.selected && styles.selectableItemSelected,
      ]}
    >
      <Text style={styles.selectableTitle}>{props.label}</Text>
      {props.description ? (
        <Text style={styles.selectableSubtitle}>{props.description}</Text>
      ) : null}
    </Pressable>
  );
}

function NavBar(props: {
  tabs: Array<{ key: ScreenKey; label: string }>;
  active: ScreenKey;
  onChange: (screen: ScreenKey) => void;
}) {
  return (
    <View style={styles.navBar}>
      {props.tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => props.onChange(tab.key)}
          style={[styles.navItem, props.active === tab.key && styles.navItemActive]}
        >
          <Text
            style={[
              styles.navText,
              props.active === tab.key && styles.navTextActive,
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function OverviewPanel(props: {
  session: Session | null;
  availableTrails: Trail[];
  availableMountains: Mountain[];
  announcements: Announcement[];
  onRefresh: () => Promise<void>;
  loading: boolean;
}) {
  return (
    <SectionCard title="Overview" eyebrow="Dashboard">
      <View style={styles.statsRow}>
        <Stat label="Open trails" value={props.availableTrails.length} />
        <Stat label="Mountains" value={props.availableMountains.length} />
        <Stat label="Announcements" value={props.announcements.length} />
      </View>
      <Text style={styles.bodyText}>
        Signed in as {props.session?.user.first_name ?? "Guest"}{" "}
        {props.session?.user.last_name ?? ""}
      </Text>
      <Text style={styles.bodyTextMuted}>
        {props.availableTrails.length > 0
          ? "Use the tabs below to create manifests, join bookings, report hazards, and manage LGU workflows."
          : "No data loaded yet. Tap refresh if the backend has just been started."}
      </Text>
      <Pressable
        onPress={() => void props.onRefresh()}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>
          {props.loading ? "Refreshing..." : "Refresh everything"}
        </Text>
      </Pressable>
      <MiniList
        title="Latest announcements"
        items={props.announcements.slice(0, 3).map((item) => ({
          title: item.title ?? "Announcement",
          subtitle: item.content ?? "",
        }))}
      />
    </SectionCard>
  );
}

function AuthPanel(props: {
  authForm: typeof initialAuthForm;
  setAuthForm: Dispatch<SetStateAction<typeof initialAuthForm>>;
  apiBaseUrl: string;
  setApiBaseUrl: (value: string) => void;
  onSaveApiUrl: () => void;
  onLogin: () => void;
  onRegister: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="Sign in" eyebrow="Authentication">
      <Field
        label="Email"
        value={props.authForm.email}
        onChangeText={(value) =>
          props.setAuthForm((current) => ({ ...current, email: value }))
        }
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Password"
        value={props.authForm.password}
        onChangeText={(value) =>
          props.setAuthForm((current) => ({ ...current, password: value }))
        }
        secureTextEntry
        autoCapitalize="none"
      />
      <View style={styles.segmentRow}>
        <Pressable
          onPress={() =>
            props.setAuthForm((current) => ({ ...current, role: "hiker" }))
          }
          style={[
            styles.segmentButton,
            props.authForm.role === "hiker" && styles.segmentButtonActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              props.authForm.role === "hiker" && styles.segmentTextActive,
            ]}
          >
            Hiker
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            props.setAuthForm((current) => ({ ...current, role: "organizer" }))
          }
          style={[
            styles.segmentButton,
            props.authForm.role === "organizer" && styles.segmentButtonActive,
          ]}
        >
          <Text
            style={[
              styles.segmentText,
              props.authForm.role === "organizer" && styles.segmentTextActive,
            ]}
          >
            Organizer
          </Text>
        </Pressable>
      </View>
      <View style={styles.inputRow}>
        <Field
          label="First name"
          value={props.authForm.firstName}
          onChangeText={(value) =>
            props.setAuthForm((current) => ({ ...current, firstName: value }))
          }
        />
        <Field
          label="Last name"
          value={props.authForm.lastName}
          onChangeText={(value) =>
            props.setAuthForm((current) => ({ ...current, lastName: value }))
          }
        />
      </View>
      <Field
        label="Address"
        value={props.authForm.address}
        onChangeText={(value) =>
          props.setAuthForm((current) => ({ ...current, address: value }))
        }
      />
      <Field
        label="Backend API URL"
        value={props.apiBaseUrl}
        onChangeText={props.setApiBaseUrl}
        placeholder="https://capstone-api.onrender.com"
        autoCapitalize="none"
      />
      <View style={styles.actionRow}>
        <Pressable
          onPress={props.onSaveApiUrl}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>Save API URL</Text>
        </Pressable>
        <Pressable
          onPress={props.onLogin}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.primaryButtonText}>
            {props.loading ? "Signing in..." : "Login"}
          </Text>
        </Pressable>
        <Pressable
          onPress={props.onRegister}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>Register</Text>
        </Pressable>
      </View>
    </SectionCard>
  );
}

function AccessRequestPanel(props: {
  form: typeof initialAccessRequestForm;
  setForm: Dispatch<SetStateAction<typeof initialAccessRequestForm>>;
  onSubmit: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="LGU access request" eyebrow="Public form">
      <Field
        label="Email"
        value={props.form.email}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, email: value }))
        }
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="LGU name"
        value={props.form.lguName}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, lguName: value }))
        }
      />
      <Field
        label="Province"
        value={props.form.province}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, province: value }))
        }
      />
      <Field
        label="Municipality or city"
        value={props.form.municipalityCity}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, municipalityCity: value }))
        }
      />
      <Field
        label="Office name"
        value={props.form.officeName}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, officeName: value }))
        }
      />
      <Field
        label="Contact person"
        value={props.form.contactPerson}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, contactPerson: value }))
        }
      />
      <Field
        label="Contact number"
        value={props.form.contactNumber}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, contactNumber: value }))
        }
      />
      <Field
        label="Office address"
        value={props.form.officeAddress}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, officeAddress: value }))
        }
      />
      <Field
        label="Message"
        value={props.form.message}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, message: value }))
        }
        multiline
      />
      <Pressable
        onPress={props.onSubmit}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>
          {props.loading ? "Submitting..." : "Request access"}
        </Text>
      </Pressable>
    </SectionCard>
  );
}

function ManifestPanel(props: {
  session: Session | null;
  isOrganizer: boolean;
  isHiker: boolean;
  trails: Trail[];
  form: typeof initialManifestForm;
  setForm: Dispatch<SetStateAction<typeof initialManifestForm>>;
  onCreate: () => void;
  onJoin: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="Manifests" eyebrow="Bookings">
      <MiniList
        title="Open trails"
        items={props.trails.slice(0, 5).map((trail) => ({
          title: trail.trail_name ?? "Unnamed trail",
          subtitle:
            `${trail.mountain_name ?? "Unknown mountain"} · ${
              trail.active_safety_status ?? "unknown"
            }`,
        }))}
      />
      {props.isOrganizer ? (
        <>
          <Field
            label="Trail ID"
            value={props.form.trailId}
            onChangeText={(value) =>
              props.setForm((current) => ({ ...current, trailId: value }))
            }
            autoCapitalize="none"
          />
          <Field
            label="Climb date"
            value={props.form.climbDate}
            onChangeText={(value) =>
              props.setForm((current) => ({ ...current, climbDate: value }))
            }
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />
          <Pressable
            onPress={props.onCreate}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>
              {props.loading ? "Creating..." : "Create manifest"}
            </Text>
          </Pressable>
        </>
      ) : null}
      {props.isHiker ? (
        <>
          <Field
            label="Room code"
            value={props.form.roomCode}
            onChangeText={(value) =>
              props.setForm((current) => ({ ...current, roomCode: value.toUpperCase() }))
            }
            autoCapitalize="characters"
          />
          <Pressable
            onPress={props.onJoin}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>
              {props.loading ? "Joining..." : "Join manifest"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </SectionCard>
  );
}

function TrackingPanel(props: {
  session: Session | null;
  forms: typeof initialTrackingForms;
  setForms: Dispatch<SetStateAction<typeof initialTrackingForms>>;
  onCheckpoint: () => void;
  onHazard: () => void;
  onSos: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="Tracking" eyebrow="Safety tools">
      <Field
        label="Manifest ID"
        value={props.forms.checkpoint.manifestId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            checkpoint: { ...current.checkpoint, manifestId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Checkpoint ID"
        value={props.forms.checkpoint.checkpointId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            checkpoint: { ...current.checkpoint, checkpointId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Pressable
        onPress={props.onCheckpoint}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>
          {props.loading ? "Logging..." : "Log checkpoint passage"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Trail ID"
        value={props.forms.hazard.trailId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            hazard: { ...current.hazard, trailId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Incident type"
        value={props.forms.hazard.incidentType}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            hazard: { ...current.hazard, incidentType: value },
          }))
        }
        placeholder="blockage, landslide_risk, trail_damage, wasp_infestation, medical"
        autoCapitalize="none"
      />
      <Field
        label="Description"
        value={props.forms.hazard.description}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            hazard: { ...current.hazard, description: value },
          }))
        }
        multiline
      />
      <View style={styles.inputRow}>
        <Field
          label="Latitude"
          value={props.forms.hazard.latitude}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              hazard: { ...current.hazard, latitude: value },
            }))
          }
          keyboardType="numeric"
        />
        <Field
          label="Longitude"
          value={props.forms.hazard.longitude}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              hazard: { ...current.hazard, longitude: value },
            }))
          }
          keyboardType="numeric"
        />
      </View>
      <Pressable
        onPress={props.onHazard}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>
          {props.loading ? "Submitting..." : "Report hazard"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Manifest ID"
        value={props.forms.sos.manifestId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            sos: { ...current.sos, manifestId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Emergency details"
        value={props.forms.sos.emergencyDetails}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            sos: { ...current.sos, emergencyDetails: value },
          }))
        }
        multiline
      />
      <View style={styles.inputRow}>
        <Field
          label="Latitude"
          value={props.forms.sos.latitude}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              sos: { ...current.sos, latitude: value },
            }))
          }
          keyboardType="numeric"
        />
        <Field
          label="Longitude"
          value={props.forms.sos.longitude}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              sos: { ...current.sos, longitude: value },
            }))
          }
          keyboardType="numeric"
        />
      </View>
      <Pressable
        onPress={props.onSos}
        style={({ pressed }) => [styles.dangerButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.dangerButtonText}>
          {props.loading ? "Sending..." : "Send SOS alert"}
        </Text>
      </Pressable>
    </SectionCard>
  );
}

function CompliancePanel(props: {
  session: Session | null;
  isHiker: boolean;
  isLgu: boolean;
  forms: typeof initialComplianceForms;
  setForms: Dispatch<SetStateAction<typeof initialComplianceForms>>;
  documentTypes: DocumentType[];
  onUpload: () => void;
  onCreateType: () => void;
  onVerify: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="Compliance" eyebrow="Documents">
      {props.isHiker ? (
        <>
          <Field
            label="Manifest item ID"
            value={props.forms.upload.manifestItemId}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                upload: { ...current.upload, manifestItemId: value },
              }))
            }
            autoCapitalize="none"
          />
          <Field
            label="Document type ID"
            value={props.forms.upload.documentTypeId}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                upload: { ...current.upload, documentTypeId: value },
              }))
            }
            autoCapitalize="none"
          />
          <Field
            label="File URL"
            value={props.forms.upload.uploadedFileUrl}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                upload: { ...current.upload, uploadedFileUrl: value },
              }))
            }
            autoCapitalize="none"
          />
          <Pressable
            onPress={props.onUpload}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>
              {props.loading ? "Uploading..." : "Upload document"}
            </Text>
          </Pressable>
        </>
      ) : null}

      {props.isLgu ? (
        <>
          <Field
            label="Document name"
            value={props.forms.documentType.documentName}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                documentType: { ...current.documentType, documentName: value },
              }))
            }
          />
          <Field
            label="Description"
            value={props.forms.documentType.description}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                documentType: { ...current.documentType, description: value },
              }))
            }
          />
          <Field
            label="Required"
            value={props.forms.documentType.isRequired}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                documentType: {
                  ...current.documentType,
                  isRequired: value.toLowerCase().includes("false") ? "false" : "true",
                },
              }))
            }
            placeholder="true or false"
            autoCapitalize="none"
          />
          <Pressable
            onPress={props.onCreateType}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.secondaryButtonText}>
              {props.loading ? "Creating..." : "Create document type"}
            </Text>
          </Pressable>

          <MiniList
            title="Document types"
            items={props.documentTypes.slice(0, 5).map((item) => ({
              title: item.document_name ?? "Document type",
              subtitle: `${item.document_type_id ?? ""} ${item.is_required ? "required" : "optional"}`,
            }))}
          />

          <Divider />

          <Field
            label="Document ID"
            value={props.forms.verify.documentId}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                verify: { ...current.verify, documentId: value },
              }))
            }
            autoCapitalize="none"
          />
          <Field
            label="Status"
            value={props.forms.verify.verificationStatus}
            onChangeText={(value) =>
              props.setForms((current) => ({
                ...current,
                verify: {
                  ...current.verify,
                  verificationStatus: value as
                    | "pending_review"
                    | "verified"
                    | "rejected",
                },
              }))
            }
            placeholder="pending_review, verified, rejected"
            autoCapitalize="none"
          />
          <Pressable
            onPress={props.onVerify}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
          >
            <Text style={styles.primaryButtonText}>
              {props.loading ? "Updating..." : "Verify document"}
            </Text>
          </Pressable>
        </>
      ) : null}
    </SectionCard>
  );
}

function AnnouncementsPanel(props: {
  session: Session | null;
  announcements: Announcement[];
  form: typeof initialAnnouncementForm;
  setForm: Dispatch<SetStateAction<typeof initialAnnouncementForm>>;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="Announcements" eyebrow="Public news">
      <MiniList
        title="Recent announcements"
        items={props.announcements.slice(0, 8).map((item) => ({
          title: item.title ?? "Announcement",
          subtitle: item.content ?? "",
        }))}
      />
      <Field
        label="Manifest ID"
        value={props.form.manifestId}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, manifestId: value }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Title"
        value={props.form.title}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, title: value }))
        }
      />
      <Field
        label="Content"
        value={props.form.content}
        onChangeText={(value) =>
          props.setForm((current) => ({ ...current, content: value }))
        }
        multiline
      />
      <Pressable
        onPress={props.onCreate}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>
          {props.loading ? "Posting..." : "Post announcement"}
        </Text>
      </Pressable>
    </SectionCard>
  );
}

function LguPanel(props: {
  session: Session | null;
  mountains: Mountain[];
  trails: Trail[];
  checkpointStations: CheckpointStation[];
  guides: Guide[];
  forms: typeof initialLguForms;
  setForms: Dispatch<SetStateAction<typeof initialLguForms>>;
  onCreateMountain: () => void;
  onCreateTrail: () => void;
  onCreateCheckpointStation: () => void;
  onCreateGuide: () => void;
  onApproveManifest: () => void;
  onIssuePermit: () => void;
  loading: boolean;
}) {
  return (
    <SectionCard title="LGU tools" eyebrow="Administration">
      <MiniList
        title="Mountains"
        items={props.mountains.slice(0, 4).map((item) => ({
          title: item.mountain_name ?? "Mountain",
          subtitle: item.location_description ?? "",
        }))}
      />
      <MiniList
        title="Trails"
        items={props.trails.slice(0, 4).map((item) => ({
          title: item.trail_name ?? "Trail",
          subtitle: item.mountain_name ?? "",
        }))}
      />
      <MiniList
        title="Checkpoint stations"
        items={props.checkpointStations.slice(0, 4).map((item) => ({
          title: item.checkpoint_name ?? "Checkpoint",
          subtitle: `${item.trail_id ?? ""} #${item.sequence_number ?? ""}`,
        }))}
      />
      <MiniList
        title="Guides"
        items={props.guides.slice(0, 4).map((item) => ({
          title: `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim() || "Guide",
          subtitle: item.email ?? "",
        }))}
      />

      <Divider />

      <Field
        label="Mountain name"
        value={props.forms.mountain.mountainName}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            mountain: { ...current.mountain, mountainName: value },
          }))
        }
      />
      <Field
        label="Location description"
        value={props.forms.mountain.locationDescription}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            mountain: { ...current.mountain, locationDescription: value },
          }))
        }
      />
      <Pressable
        onPress={props.onCreateMountain}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>
          {props.loading ? "Creating..." : "Create mountain"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Mountain ID"
        value={props.forms.trail.mountainId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            trail: { ...current.trail, mountainId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Trail name"
        value={props.forms.trail.trailName}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            trail: { ...current.trail, trailName: value },
          }))
        }
      />
      <View style={styles.inputRow}>
        <Field
          label="Latitude"
          value={props.forms.trail.latitude}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              trail: { ...current.trail, latitude: value },
            }))
          }
          keyboardType="numeric"
        />
        <Field
          label="Longitude"
          value={props.forms.trail.longitude}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              trail: { ...current.trail, longitude: value },
            }))
          }
          keyboardType="numeric"
        />
      </View>
      <Field
        label="Carrying capacity"
        value={props.forms.trail.dailyCarryingCapacity}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            trail: { ...current.trail, dailyCarryingCapacity: value },
          }))
        }
        keyboardType="numeric"
      />
      <Pressable
        onPress={props.onCreateTrail}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>
          {props.loading ? "Creating..." : "Create trail"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Trail ID"
        value={props.forms.checkpointStation.trailId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            checkpointStation: { ...current.checkpointStation, trailId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Checkpoint name"
        value={props.forms.checkpointStation.checkpointName}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            checkpointStation: { ...current.checkpointStation, checkpointName: value },
          }))
        }
      />
      <Field
        label="Sequence number"
        value={props.forms.checkpointStation.sequenceNumber}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            checkpointStation: { ...current.checkpointStation, sequenceNumber: value },
          }))
        }
        keyboardType="numeric"
      />
      <Pressable
        onPress={props.onCreateCheckpointStation}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>
          {props.loading ? "Creating..." : "Create checkpoint"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Email"
        value={props.forms.guide.email}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            guide: { ...current.guide, email: value },
          }))
        }
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <Field
        label="Password"
        value={props.forms.guide.password}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            guide: { ...current.guide, password: value },
          }))
        }
        secureTextEntry
        autoCapitalize="none"
      />
      <View style={styles.inputRow}>
        <Field
          label="First name"
          value={props.forms.guide.firstName}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              guide: { ...current.guide, firstName: value },
            }))
          }
        />
        <Field
          label="Last name"
          value={props.forms.guide.lastName}
          onChangeText={(value) =>
            props.setForms((current) => ({
              ...current,
              guide: { ...current.guide, lastName: value },
            }))
          }
        />
      </View>
      <Field
        label="License number"
        value={props.forms.guide.licenseNumber}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            guide: { ...current.guide, licenseNumber: value },
          }))
        }
      />
      <Field
        label="Contact number"
        value={props.forms.guide.contactNumber}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            guide: { ...current.guide, contactNumber: value },
          }))
        }
      />
      <Pressable
        onPress={props.onCreateGuide}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>
          {props.loading ? "Creating..." : "Create guide"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Manifest ID"
        value={props.forms.approveManifest.manifestId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            approveManifest: { ...current.approveManifest, manifestId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="Guide ID"
        value={props.forms.approveManifest.guideId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            approveManifest: { ...current.approveManifest, guideId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Pressable
        onPress={props.onApproveManifest}
        style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.secondaryButtonText}>
          {props.loading ? "Approving..." : "Approve manifest"}
        </Text>
      </Pressable>

      <Divider />

      <Field
        label="Manifest ID"
        value={props.forms.issuePermit.manifestId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            issuePermit: { ...current.issuePermit, manifestId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Field
        label="User ID"
        value={props.forms.issuePermit.userId}
        onChangeText={(value) =>
          props.setForms((current) => ({
            ...current,
            issuePermit: { ...current.issuePermit, userId: value },
          }))
        }
        autoCapitalize="none"
      />
      <Pressable
        onPress={props.onIssuePermit}
        style={({ pressed }) => [styles.dangerButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.dangerButtonText}>
          {props.loading ? "Issuing..." : "Issue permit"}
        </Text>
      </Pressable>
    </SectionCard>
  );
}

function SettingsPanel(props: {
  session: Session | null;
  apiBaseUrl: string;
  setApiBaseUrl: (value: string) => void;
  onSaveApiUrl: () => void;
  onLogout: () => void;
}) {
  return (
    <SectionCard title="Settings" eyebrow="Device setup">
      <Field
        label="Backend API URL"
        value={props.apiBaseUrl}
        onChangeText={props.setApiBaseUrl}
        placeholder="http://192.168.1.10:3000"
        autoCapitalize="none"
      />
      <Pressable
        onPress={props.onSaveApiUrl}
        style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.primaryButtonText}>Save API URL</Text>
      </Pressable>
      <Text style={styles.bodyTextMuted}>
        For a physical phone, point this to your computer's LAN address or use a
        reachable tunnel URL. Expo Go handles the app bundle; the API still needs
        to be reachable from the phone. Your backend defaults to port 5000.
      </Text>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Phone viewing checklist</Text>
        <Text style={styles.infoText}>1. Start the API server on your computer.</Text>
        <Text style={styles.infoText}>2. Put the computer and phone on the same network.</Text>
        <Text style={styles.infoText}>3. Set the API URL above to your computer's LAN IP on port 5000.</Text>
        <Text style={styles.infoText}>
          4. Run Expo with `npm run mobile:start:tunnel` if LAN discovery is unreliable.
        </Text>
      </View>
      <Text style={styles.bodyTextMuted}>
        Signed in as {props.session?.user.first_name ?? "Guest"} {props.session?.user.last_name ?? ""} ({props.session?.user.email ?? ""})
      </Text>
      <Pressable
        onPress={props.onLogout}
        style={({ pressed }) => [styles.ghostButton, pressed && styles.buttonPressed]}
      >
        <Text style={styles.ghostButtonText}>Logout</Text>
      </Pressable>
    </SectionCard>
  );
}

function MiniList(props: { title: string; items: Array<{ title: string; subtitle?: string }> }) {
  return (
    <View style={styles.miniList}>
      <Text style={styles.miniListTitle}>{props.title}</Text>
      {props.items.length === 0 ? (
        <Text style={styles.emptyText}>Nothing to show yet.</Text>
      ) : (
        props.items.map((item, index) => (
          <View key={`${item.title}-${index}`} style={styles.listItem}>
            <Text style={styles.listItemTitle}>{item.title}</Text>
            {item.subtitle ? (
              <Text style={styles.listItemSubtitle}>{item.subtitle}</Text>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function Stat(props: { label: string; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{props.value}</Text>
      <Text style={styles.statLabel}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#08121A",
  },
  bootstrap: {
    flex: 1,
    backgroundColor: "#08121A",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  bootstrapText: {
    color: "#D7EAF7",
    fontSize: 15,
  },
  scrollContent: {
    flexGrow: 1,
  },
  shell: {
    padding: 18,
    gap: 16,
  },
  glowTop: {
    position: "absolute",
    top: -120,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(126, 216, 255, 0.18)",
  },
  glowBottom: {
    position: "absolute",
    bottom: -120,
    right: -100,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: "rgba(35, 102, 155, 0.22)",
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: "rgba(10, 26, 38, 0.96)",
    borderWidth: 1,
    borderColor: "rgba(128, 194, 231, 0.14)",
    gap: 10,
  },
  kicker: {
    color: "#7ED8FF",
    textTransform: "uppercase",
    letterSpacing: 1.6,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: "#F3FBFF",
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  subtitle: {
    color: "#B9D5E7",
    fontSize: 15,
    lineHeight: 22,
  },
  heroNote: {
    color: "#9CB7CA",
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  pill: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    minWidth: 120,
  },
  pillLabel: {
    color: "#7C97AB",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  pillValue: {
    color: "#EAF8FF",
    fontSize: 12,
    fontWeight: "600",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "rgba(13, 31, 45, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(130, 196, 227, 0.12)",
    gap: 14,
  },
  sectionEyebrow: {
    color: "#7ED8FF",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 11,
    fontWeight: "700",
  },
  cardTitle: {
    color: "#F3FBFF",
    fontSize: 22,
    fontWeight: "800",
  },
  cardBody: {
    gap: 14,
  },
  field: {
    gap: 8,
  },
  fieldLabel: {
    color: "#B9D5E7",
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderRadius: 16,
    backgroundColor: "#08151F",
    color: "#F3FBFF",
    borderWidth: 1,
    borderColor: "rgba(126, 216, 255, 0.12)",
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
  },
  inputMultiline: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  primaryButton: {
    backgroundColor: "#7ED8FF",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#08151F",
    fontWeight: "800",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "rgba(126, 216, 255, 0.14)",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#DFF7FF",
    fontWeight: "700",
  },
  ghostButton: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  ghostButtonText: {
    color: "#F3FBFF",
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "#FF7A7A",
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  dangerButtonText: {
    color: "#2B0F10",
    fontWeight: "800",
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  navBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  navItem: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  navItemActive: {
    backgroundColor: "#7ED8FF",
  },
  navText: {
    color: "#B9D5E7",
    fontWeight: "700",
    fontSize: 12,
  },
  navTextActive: {
    color: "#08151F",
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
  segmentButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  segmentButtonActive: {
    backgroundColor: "#7ED8FF",
  },
  segmentText: {
    color: "#B9D5E7",
    fontWeight: "700",
  },
  segmentTextActive: {
    color: "#08151F",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  statCard: {
    flex: 1,
    minWidth: 88,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    gap: 4,
  },
  statValue: {
    color: "#F3FBFF",
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    color: "#91AFC5",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  bodyText: {
    color: "#F3FBFF",
    fontSize: 15,
    lineHeight: 20,
  },
  bodyTextMuted: {
    color: "#91AFC5",
    fontSize: 14,
    lineHeight: 20,
  },
  miniList: {
    gap: 10,
  },
  miniListTitle: {
    color: "#7ED8FF",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 11,
    fontWeight: "700",
  },
  listItem: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  listItemTitle: {
    color: "#F3FBFF",
    fontSize: 15,
    fontWeight: "700",
  },
  listItemSubtitle: {
    color: "#B9D5E7",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    color: "#91AFC5",
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 2,
  },
  infoCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  infoTitle: {
    color: "#F3FBFF",
    fontSize: 15,
    fontWeight: "700",
  },
  infoText: {
    color: "#B9D5E7",
    fontSize: 13,
    lineHeight: 18,
  },
  selectableItem: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    gap: 4,
  },
  selectableItemSelected: {
    borderColor: "#7ED8FF",
    backgroundColor: "rgba(126, 216, 255, 0.14)",
  },
  selectableTitle: {
    color: "#F3FBFF",
    fontSize: 14,
    fontWeight: "700",
  },
  selectableSubtitle: {
    color: "#B9D5E7",
    fontSize: 13,
  },
});
