import {
  IncidentReport,
  SatelliteObservation,
  HelpRequest,
  MachineAsset,
} from "../domain/schemas";

const REPORT_LAT = 30.3398;
const REPORT_LNG = 76.3869;

// ~400m away
const SATELLITE_LAT = 30.3362;
const SATELLITE_LNG = 76.3869;

// ~6km away
const CHC_LAT = 30.3938;
const CHC_LNG = 76.3869;

export const initialSeedData: {
  reports: IncidentReport[];
  observations: SatelliteObservation[];
  helpRequests: HelpRequest[];
  machineAssets: MachineAsset[];
} = {
  reports: [
    {
      id: "report-1",
      reportedAt: "2023-11-01T08:00:00Z",
      reporterId: "citizen-123",
      location: { lat: REPORT_LAT, lng: REPORT_LNG },
      description: "Thick smoke visible from the main road.",
      district: "Patiala",
      status: "OPEN",
    },
  ],
  observations: [
    {
      id: "obs-1",
      source: "NASA_FIRMS",
      observedAt: "2023-11-01T07:45:00Z", // 15 mins before report
      location: { lat: SATELLITE_LAT, lng: SATELLITE_LNG },
      confidence: 85,
      brightness: 320.5,
    },
    // Non-matching record (negative test) - too far and wrong time
    {
      id: "obs-2",
      source: "SEED",
      observedAt: "2023-10-25T07:45:00Z",
      location: { lat: 31.0, lng: 77.0 },
      confidence: 10,
      brightness: 200.0,
    },
  ],
  helpRequests: [
    {
      id: "req-1",
      farmerId: "farmer-999",
      farmLocation: { lat: REPORT_LAT, lng: REPORT_LNG },
      district: "Patiala",
      crop: "Paddy",
      acreage: 15,
      machineType: "Happy Seeder",
      requiredFrom: "2023-10-28T00:00:00Z",
      requiredUntil: "2023-11-05T00:00:00Z",
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
      location: { lat: CHC_LAT, lng: CHC_LNG },
      machineType: "Happy Seeder",
      availableFrom: "2023-11-01T00:00:00Z",
      availableUntil: "2023-11-30T00:00:00Z",
      status: "AVAILABLE",
      capacityAcresPerDay: 8,
    },
  ],
};
