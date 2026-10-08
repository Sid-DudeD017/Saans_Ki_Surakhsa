import { z } from "zod";

export const IndiaTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((val) => val.endsWith("+05:30"), {
    message: "Timestamp must explicitly use the +05:30 offset",
  });

export const LocationSchema = z.object({
  lat: z.number(),
  lon: z.number(),
}).strict();

export const IncidentReportSchema = z.object({
  id: z.string(),
  reportedAt: IndiaTimestampSchema,
  reporterId: z.string(),
  location: LocationSchema,
  description: z.string(),
  mediaUrls: z.array(z.string().url()).optional(),
  district: z.string(),
  status: z.enum(["OPEN", "CLOSED"]),
});
export type IncidentReport = z.infer<typeof IncidentReportSchema>;

export const SatelliteObservationSchema = z.object({
  id: z.string(),
  source: z.enum(["NASA_FIRMS", "SEED"]),
  observedAt: IndiaTimestampSchema,
  location: LocationSchema,
  confidence: z.number(),
  brightness: z.number(),
  frp: z.number().optional(),
  distanceFromReportMeters: z.number().optional(),
});
export type SatelliteObservation = z.infer<typeof SatelliteObservationSchema>;

export const HelpRequestSchema = z.object({
  id: z.string(),
  farmerId: z.string(),
  farmLocation: LocationSchema,
  district: z.string(),
  crop: z.string(),
  acreage: z.number(),
  machineType: z.string(),
  requiredFrom: IndiaTimestampSchema,
  requiredUntil: IndiaTimestampSchema,
  coveragePercent: z.number(),
  uncoveredAcres: z.number(),
  status: z.enum(["OPEN", "MATCHED", "FULFILLED", "EXPIRED"]),
});
export type HelpRequest = z.infer<typeof HelpRequestSchema>;

export const MachineAssetSchema = z.object({
  id: z.string(),
  chcId: z.string(),
  chcName: z.string(),
  location: LocationSchema,
  machineType: z.string(),
  availableFrom: IndiaTimestampSchema,
  availableUntil: IndiaTimestampSchema,
  status: z.enum(["AVAILABLE", "IN_USE", "MAINTENANCE"]),
  capacityAcresPerDay: z.number().optional(),
});
export type MachineAsset = z.infer<typeof MachineAssetSchema>;

export const CommandCaseSchema = z.object({
  id: z.string(),
  incidentReportId: z.string(),
  verificationStatus: z.enum([
    "UNVERIFIED",
    "SATELLITE_CORROBORATED",
    "NO_MATCH",
    "NEEDS_REVIEW",
  ]),
  observationId: z.string().optional(),
  helpRequestId: z.string().optional(),
  recommendedMachineId: z.string().optional(),
  evidenceSummary: z.string().optional(),
  recommendationReason: z.string().optional(),
  status: z.enum(["OPEN", "ACTION_APPROVED", "ACTION_CHANGED", "CLOSED"]),
  version: z.number(),
  createdAt: IndiaTimestampSchema,
  updatedAt: IndiaTimestampSchema,
});
export type CommandCase = z.infer<typeof CommandCaseSchema>;

export const OfficerDecisionSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  officerId: z.string(),
  action: z.enum(["APPROVE", "CHANGE", "REJECT"]),
  selectedMachineId: z.string().optional(),
  reason: z.string().min(1),
  createdAt: IndiaTimestampSchema,
  previousCaseVersion: z.number(),
});
export type OfficerDecision = z.infer<typeof OfficerDecisionSchema>;
