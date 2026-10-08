import {
  IncidentReport,
  SatelliteObservation,
  HelpRequest,
  MachineAsset,
} from "../domain/schemas";

const REPORT_LAT = 30.266;
const REPORT_LON = 76.04;

// ~400m away
const SATELLITE_LAT = 30.2624;
const SATELLITE_LON = 76.04;

// Bhawanigarh CHC
const CHC_LAT = 30.284;
const CHC_LON = 76.04;

export const initialSeedData: {
  reports: IncidentReport[];
  observations: SatelliteObservation[];
  helpRequests: HelpRequest[];
  machineAssets: MachineAsset[];
} = {
  reports: [
    {
      id: "report-1",
      reportedAt: "2023-11-01T08:00:00+05:30",
      reporterId: "citizen-123",
      location: { lat: REPORT_LAT, lon: REPORT_LON },
      description: "Thick smoke visible from the main road.",
      district: "Sangrur",
      status: "OPEN",
    },
  ],
  observations: [
    {
      id: "obs-1",
      source: "NASA_FIRMS",
      observedAt: "2023-11-01T07:45:00+05:30", // 15 mins before report
      location: { lat: SATELLITE_LAT, lon: SATELLITE_LON },
      confidence: 85,
      brightness: 320.5,
    },
    // Non-matching record (negative test) - too far and wrong time
    {
      id: "obs-2",
      source: "SEED",
      observedAt: "2023-10-25T07:45:00+05:30",
      location: { lat: 31.0, lon: 77.0 },
      confidence: 10,
      brightness: 200.0,
    },
  ],
  helpRequests: [
    {
      id: "req-1",
      farmerId: "farmer-999",
      farmLocation: { lat: REPORT_LAT, lon: REPORT_LON },
      district: "Sangrur",
      crop: "Paddy",
      acreage: 15,
      machineType: "Happy Seeder",
      requiredFrom: "2023-10-28T00:00:00+05:30",
      requiredUntil: "2023-11-05T00:00:00+05:30",
      coveragePercent: 0,
      uncoveredAcres: 15,
      status: "OPEN",
    },
  ],
  machineAssets: [
    {
      id: "machine-1",
      chcId: "chc-bhaini",
      chcName: "Bhaini CHC",
      location: { lat: CHC_LAT, lon: CHC_LON },
      machineType: "Happy Seeder",
      availableFrom: "2023-11-01T00:00:00+05:30",
      availableUntil: "2023-11-30T00:00:00+05:30",
      status: "AVAILABLE",
      capacityAcresPerDay: 8,
    },
  ],
};
