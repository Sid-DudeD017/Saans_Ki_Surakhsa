// Request bodies for POST /v1/uploads and POST /v1/complaints, as p4-command.openapi.yaml and P1's
// FarmerSupportComplaint describe them. inputs.test.ts checks these enums against the spec.
import { z } from "zod";

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/heic", "audio/mp4", "audio/ogg", "audio/wav"] as const;
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const CITIZEN_TYPES = ["farm_fire", "garbage", "vehicle", "firecrackers", "dust", "industrial"] as const;

export const GeoPoint = z.strictObject({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof GeoPoint>;

const Sha256 = z.string().regex(/^[0-9a-f]{64}$/, "must be 64 lowercase hex characters (sha256)");

export const UploadInput = z.object({
  media_type: z.enum(MEDIA_TYPES),
  byte_size: z.int().min(1).max(MAX_UPLOAD_BYTES),
  sha256: Sha256,
});
export type UploadInput = z.infer<typeof UploadInput>;

export const EvidenceMetadata = z.object({
  object_key: z.string().min(1),
  media_type: z.string().min(1),
  hash: Sha256,
  captured_timestamp: z.iso.datetime({ offset: true }),
  location: GeoPoint.optional(),
});
export type EvidenceMetadata = z.infer<typeof EvidenceMetadata>;

export const ComplaintInput = z.object({
  type: z.enum(CITIZEN_TYPES),
  location: GeoPoint,
  description: z.string().max(1000).optional(),
  evidence: z.array(EvidenceMetadata).max(10),
});
export type ComplaintInput = z.infer<typeof ComplaintInput>;

// Command's HelpRequest; Kisan sends extra fields for the case view, which are kept.
const HelpRequest = z.looseObject({
  id: z.string().min(1),
  farmerId: z.string().min(1),
  farmLocation: GeoPoint,
  district: z.string().min(1),
  crop: z.string(),
  acreage: z.number(),
  machineType: z.string(),
  requiredFrom: z.string(),
  requiredUntil: z.string(),
  coveragePercent: z.number(),
  uncoveredAcres: z.number(),
  status: z.enum(["OPEN", "MATCHED", "FULFILLED", "EXPIRED"]),
});

export const FarmerSupportComplaint = z.object({
  type: z.literal("farmer_support").default("farmer_support"),
  location: GeoPoint,
  evidence: z.array(EvidenceMetadata).max(10).default([]),
  support_request: z.looseObject({}),
  help_request: HelpRequest,
});
export type FarmerSupportComplaint = z.infer<typeof FarmerSupportComplaint>;

export type Complaint = ComplaintInput | FarmerSupportComplaint;

/** The contract's oneOf: farmer_support (type may be left out, it defaults) or a citizen report. */
export function parseComplaint(body: unknown) {
  const isSupport =
    !!body && typeof body === "object" &&
    ((body as { type?: unknown }).type === "farmer_support" ||
      ((body as { type?: unknown }).type === undefined && "support_request" in body));
  return isSupport ? FarmerSupportComplaint.safeParse(body) : ComplaintInput.safeParse(body);
}
