-- Run these statements in your Render PostgreSQL Query tab.
-- This matches the current backend flow:
-- 1. Super admin creates LGU accounts
-- 2. LGU can submit an access request from the frontend
-- 3. LGU creates guides and assigns them to approved manifests

ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'guide';

CREATE TABLE IF NOT EXISTS accredited_guide (
  guide_id UUID PRIMARY KEY,
  lgu_official_id UUID NOT NULL REFERENCES lgu_profile(lgu_official_id),
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  license_number VARCHAR NOT NULL,
  contact_number VARCHAR NOT NULL,
  email VARCHAR NOT NULL UNIQUE,
  availability_status guide_availability_enum NOT NULL DEFAULT 'available',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lgu_access_request (
  request_id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  lgu_name VARCHAR NOT NULL,
  province VARCHAR,
  municipality_city VARCHAR,
  office_name VARCHAR,
  contact_person VARCHAR,
  contact_number VARCHAR,
  office_address TEXT,
  message TEXT,
  status VARCHAR NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lgu_required_document (
  document_type_id UUID PRIMARY KEY,
  lgu_official_id UUID NOT NULL REFERENCES lgu_profile(lgu_official_id),
  document_name VARCHAR NOT NULL,
  description TEXT,
  is_required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trail_resource_material (
  trail_material_id UUID PRIMARY KEY,
  manifest_id UUID NOT NULL REFERENCES expedition_manifest(manifest_id) ON DELETE CASCADE,
  lgu_official_id UUID NOT NULL REFERENCES lgu_profile(lgu_official_id),
  title VARCHAR NOT NULL,
  material_type VARCHAR NOT NULL,
  resource_url TEXT,
  description TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkpoint_station (
  checkpoint_id UUID PRIMARY KEY,
  trail_id UUID NOT NULL REFERENCES trail(trail_id),
  checkpoint_name VARCHAR NOT NULL,
  sequence_number INTEGER NOT NULL,
  static_qr_payload TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (trail_id, sequence_number),
  UNIQUE (static_qr_payload)
);

ALTER TABLE expedition_manifest
  ALTER COLUMN guide_id DROP NOT NULL;

-- The registration flow now stores a real profile photo payload.
-- If your Render database still uses a fixed-length profile_picture column,
-- widen it so base64 image data can fit.
ALTER TABLE users
  ALTER COLUMN profile_picture TYPE TEXT;

-- If you still have the old accredited_guide table in Render, migrate it manually:
-- 1. Rename or copy the data into guide
-- 2. Update any code or views that still reference accredited_guide
