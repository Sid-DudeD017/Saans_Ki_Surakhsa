import {
  ICommandCaseRepository,
  IHelpRequestRepository,
  IIncidentReportRepository,
  IMachineAssetRepository,
  IOfficerDecisionRepository,
  ISatelliteObservationRepository,
} from "../../domain/repositories";
import {
  CommandCase,
  HelpRequest,
  IncidentReport,
  MachineAsset,
  OfficerDecision,
  SatelliteObservation,
} from "../../domain/schemas";
import { initialSeedData } from "../../seed/data";

export class InMemoryIncidentReportRepository implements IIncidentReportRepository {
  private data: Map<string, IncidentReport> = new Map(
    initialSeedData.reports.map((r) => [r.id, r]),
  );

  async findById(id: string): Promise<IncidentReport | null> {
    return this.data.get(id) || null;
  }
}

export class InMemorySatelliteObservationRepository implements ISatelliteObservationRepository {
  private data: SatelliteObservation[] = [...initialSeedData.observations];

  async findNear(
    location: { lat: number; lon: number },
    maxDistanceMeters: number,
  ): Promise<SatelliteObservation[]> {
    // For Stage 1, we just return the seed data. In a real impl, we'd filter by distance.
    return this.data;
  }
}

export class InMemoryHelpRequestRepository implements IHelpRequestRepository {
  private data: HelpRequest[] = [...initialSeedData.helpRequests];

  async findOpenNear(
    location: { lat: number; lon: number },
    maxDistanceMeters: number,
  ): Promise<HelpRequest[]> {
    return this.data.filter((r) => r.status === "OPEN");
  }
}

export class InMemoryMachineAssetRepository implements IMachineAssetRepository {
  private data: MachineAsset[] = [...initialSeedData.machineAssets];

  async findAvailableNear(location: {
    lat: number;
    lon: number;
  }): Promise<MachineAsset[]> {
    return this.data.filter((m) => m.status === "AVAILABLE");
  }
}

export class InMemoryCommandCaseRepository implements ICommandCaseRepository {
  private data: Map<string, CommandCase> = new Map();

  async findById(id: string): Promise<CommandCase | null> {
    return this.data.get(id) || null;
  }

  async save(commandCase: CommandCase): Promise<void> {
    this.data.set(commandCase.id, commandCase);
  }

  async list(): Promise<CommandCase[]> {
    return Array.from(this.data.values());
  }
}

export class InMemoryOfficerDecisionRepository implements IOfficerDecisionRepository {
  private data: Map<string, OfficerDecision> = new Map();

  async save(decision: OfficerDecision): Promise<void> {
    this.data.set(decision.id, decision);
  }
}
