export type JoinedGroup = {
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

export type LookupManifest = {
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

export type ManifestAnnouncement = {
  announcement_id: string;
  manifest_id: string;
  organizer_id: string | null;
  organizer_name?: string | null;
  title: string;
  content: string;
  created_at: string;
};

export type ManifestTrailMaterial = {
  trail_material_id: string;
  manifest_id: string;
  lgu_official_id: string;
  title: string;
  material_type: "video" | "pdf" | "file" | "link" | string;
  resource_url: string | null;
  description: string | null;
  created_at: string;
};

export type ManifestRequirementDocument = {
  document_type_id: string;
  document_name: string;
  description: string | null;
  is_required: boolean;
  created_at: string;
};

export type ManifestComplianceDocument = {
  document_id: string;
  document_type_id: string;
  document_name: string;
  uploaded_file_url: string;
  verification_status: string;
  created_at: string;
};

export type ManifestPerson = {
  person_id: string;
  manifest_role: "organizer" | "guide" | "hiker";
  display_name: string;
  email: string | null;
  joined_at: string | null;
  hiker_readiness_status: string | null;
};

export type ManifestCheckpoint = {
  checkpoint_id: string;
  checkpoint_name: string;
  sequence_number: number;
  static_qr_payload: string;
  arrival_timestamp: string | null;
};

export type ManifestTrail = {
  manifestId: string;
  trailId: string;
  trailName: string | null;
  mountainName: string | null;
  locationDescription: string | null;
  difficultyRating: string | null;
  dailyCarryingCapacity: number | null;
  currentTrailOccupancy: number | null;
  progress: {
    completedCount: number;
    totalCount: number;
    nextCheckpointName: string | null;
  };
  checkpoints: ManifestCheckpoint[];
  gps: {
    found: boolean;
    query: string;
    placeName: string | null;
    coordinates: [number, number] | null;
    text: string | null;
    id: string | null;
  } | null;
};

export type ManifestRequirements = {
  manifestId: string;
  manifestItemId: string | null;
  trailMaterials: ManifestTrailMaterial[];
  complianceDocuments: ManifestComplianceDocument[];
};
