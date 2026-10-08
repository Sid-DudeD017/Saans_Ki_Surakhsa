// Saans Command's tables in PostGIS. migrate() runs this on first use; every statement is safe to
// repeat, so there is no migration tool yet. Locations are geography points (lon, lat order inside
// PostGIS; lat and lon everywhere else).
export const SCHEMA = `
CREATE EXTENSION IF NOT EXISTS postgis;

-- One row per presigned upload POST /v1/uploads handed out.
CREATE TABLE IF NOT EXISTS uploads (
  object_key  text PRIMARY KEY,
  media_type  text NOT NULL,
  byte_size   integer NOT NULL,
  sha256      text NOT NULL,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per accepted POST /v1/complaints. idempotency_key is unique, so a retry can never add a second.
CREATE TABLE IF NOT EXISTS complaints (
  id               text PRIMARY KEY,
  idempotency_key  text NOT NULL UNIQUE,
  request_hash     text NOT NULL,
  type             text NOT NULL,
  location         geography(Point, 4326) NOT NULL,
  body             jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'received',
  failure          jsonb,
  received_at      timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- What the hash-evidence step found for each file a complaint cites.
CREATE TABLE IF NOT EXISTS evidence (
  complaint_id   text NOT NULL REFERENCES complaints(id),
  object_key     text NOT NULL,
  media_type     text NOT NULL,
  claimed_hash   text NOT NULL,
  actual_hash    text,
  byte_size      integer,
  check_result   text NOT NULL,
  captured_at    timestamptz,
  location       geography(Point, 4326),
  checked_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (complaint_id, object_key)
);

-- Farmer help requests that arrive as farmer_support complaints, for the "help before penalty" link.
CREATE TABLE IF NOT EXISTS help_requests (
  id            text PRIMARY KEY,
  complaint_id  text NOT NULL REFERENCES complaints(id),
  district      text,
  location      geography(Point, 4326) NOT NULL,
  status        text NOT NULL,
  body          jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Exactly one case per complaint: complaint_id is unique, so the assign step is safe to retry.
CREATE TABLE IF NOT EXISTS cases (
  id                   text PRIMARY KEY,
  complaint_id         text NOT NULL UNIQUE REFERENCES complaints(id),
  type                 text NOT NULL,
  district             text,
  location             geography(Point, 4326) NOT NULL,
  authorities          text[] NOT NULL,
  penalty              boolean NOT NULL,
  deadline             timestamptz NOT NULL,
  verification_status  text NOT NULL,
  status               text NOT NULL DEFAULT 'OPEN',
  help_request_id      text REFERENCES help_requests(id),
  evidence_summary     text NOT NULL,
  version              integer NOT NULL DEFAULT 1,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Every state the intake workflow entered, left or failed in, so both paths can be seen.
CREATE TABLE IF NOT EXISTS workflow_events (
  id            bigserial PRIMARY KEY,
  execution_id  text NOT NULL,
  complaint_id  text NOT NULL,
  state         text NOT NULL,
  event         text NOT NULL,
  detail        jsonb,
  at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS complaints_location ON complaints USING gist (location);
CREATE INDEX IF NOT EXISTS cases_location ON cases USING gist (location);
CREATE INDEX IF NOT EXISTS help_requests_location ON help_requests USING gist (location);
CREATE INDEX IF NOT EXISTS workflow_events_complaint ON workflow_events (complaint_id, id);
`;
