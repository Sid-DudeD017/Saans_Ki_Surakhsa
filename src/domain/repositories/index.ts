import {
  CommandCase,
  HelpRequest,
  IncidentReport,
  MachineAsset,
  OfficerDecision,
  SatelliteObservation,
} from "../schemas";

export interface ICommandCaseRepository {
  findById(id: string): Promise<CommandCase | null>;
  save(commandCase: CommandCase): Promise<void>;
  list(): Promise<CommandCase[]>;
}

export interface IHelpRequestRepository {
  findOpenNear(
    location: { lat: number; lng: number },
    maxDistanceMeters: number,
  ): Promise<HelpRequest[]>;
}

export interface IIncidentReportRepository {
  findById(id: string): Promise<IncidentReport | null>;
}

export interface IMachineAssetRepository {
  findAvailableNear(location: {
    lat: number;
    lng: number;
  }): Promise<MachineAsset[]>;
}

export interface IOfficerDecisionRepository {
  save(decision: OfficerDecision): Promise<void>;
}

export interface ISatelliteObservationRepository {
  findNear(
    location: { lat: number; lng: number },
    maxDistanceMeters: number,
  ): Promise<SatelliteObservation[]>;
}
