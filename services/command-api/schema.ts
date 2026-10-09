// Saans Command's tables in PostGIS. migrate() runs this on first use; every statement is safe to
// repeat, so there is no migration tool yet. Locations are geography points (lon, lat order inside
// PostGIS; lat and lon everywhere else).
export const SCHEMA = `
-- One statement list is one implicit transaction, so this lock makes two processes migrating at once
-- (parallel test files, two Lambdas) take turns instead of racing on CREATE TABLE.
SELECT pg_advisory_xact_lock(7243);
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

-- How a fire report's case was linked to a farmer's open help request: distance, and whether another
-- request was about as close. Added after G5, so it is an ALTER that is safe to repeat.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS help_link jsonb;

-- Triage (Stage 3), added after G5: the FIRMS fire that corroborated a farm-fire report, and when a missed
-- deadline sent the case up, and to whom.
ALTER TABLE cases ADD COLUMN IF NOT EXISTS observation jsonb;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS escalated_at timestamptz;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS escalated_to text[];

-- Reports merged into an existing case as duplicates (same type, close by, soon after). The case's own
-- report is cases.complaint_id; these are the others. complaint_id is the key, so a retry can't add one twice.
CREATE TABLE IF NOT EXISTS case_reports (
  complaint_id  text PRIMARY KEY REFERENCES complaints(id),
  case_id       text NOT NULL REFERENCES cases(id),
  distance_m    double precision NOT NULL,
  merged_at     timestamptz NOT NULL DEFAULT now()
);

-- The district outlines from infra/config/districts.json, for the jurisdiction lookup. migrate() rewrites them.
CREATE TABLE IF NOT EXISTS districts (
  name      text PRIMARY KEY,
  boundary  geography(Polygon, 4326) NOT NULL
);

-- SMS already sent (notify.ts), by idempotency key, so a retried step or a second Lambda never texts twice.
-- Holds no phone numbers or message text.
CREATE TABLE IF NOT EXISTS notifications_sent (
  key      text PRIMARY KEY,
  sent_at  timestamptz NOT NULL DEFAULT now()
);

-- Every action an officer took on a case. previous_case_version is the version they acted on.
CREATE TABLE IF NOT EXISTS case_decisions (
  id                     text PRIMARY KEY,
  case_id                text NOT NULL REFERENCES cases(id),
  officer_id             text NOT NULL,
  action                 text NOT NULL,
  selected_machine_id    text,
  reason                 text NOT NULL,
  previous_case_version  integer NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now()
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
CREATE INDEX IF NOT EXISTS case_decisions_case ON case_decisions (case_id, created_at);
CREATE INDEX IF NOT EXISTS cases_deadline ON cases (deadline, id);
CREATE INDEX IF NOT EXISTS case_reports_case ON case_reports (case_id);
CREATE INDEX IF NOT EXISTS districts_boundary ON districts USING gist (boundary);
CREATE INDEX IF NOT EXISTS workflow_events_complaint ON workflow_events (complaint_id, id);
`;
