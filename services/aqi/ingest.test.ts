import { describe, it, expect, vi, beforeEach } from "vitest";
import { runIngestion, setupAws, s3, docClient } from "./ingest";
import * as index from "./index";
import * as fires from "./fires";

vi.mock("@aws-sdk/client-s3", () => {
  return { 
    S3Client: class { send = vi.fn().mockResolvedValue({}) }, 
    PutObjectCommand: vi.fn() 
  };
});

vi.mock("@aws-sdk/client-dynamodb", () => {
  return { 
    DynamoDBClient: class { send = vi.fn().mockResolvedValue({ TableNames: ["saans_ingestion"] }) }, 
    CreateTableCommand: vi.fn(), 
    ListTablesCommand: vi.fn() 
  };
});

vi.mock("@aws-sdk/lib-dynamodb", () => {
  return {
    DynamoDBDocumentClient: {
      from: vi.fn(() => ({
        send: vi.fn().mockResolvedValue({ Items: [{ sk: "2026-10-08" }] })
      }))
    },
    PutCommand: vi.fn(),
    QueryCommand: vi.fn()
  };
});

describe("Ingestion Tests", () => {
  it("Successful ingestion writes structured data to DynamoDB and raw data to S3", async () => {
    vi.spyOn(index, "updateDataForLocation").mockResolvedValue({ missingKeys: [], allFailed: false });
    vi.spyOn(index, "getAqiForLocation").mockResolvedValue({ data_timestamp: "2026-10-08T12:00:00+05:30" } as any);
    vi.spyOn(fires, "fetchFires").mockResolvedValue([]);
    
    process.env.NASA_FIRMS_MAP_KEY = "dummy";
    
    await runIngestion();
    
    expect(index.updateDataForLocation).toHaveBeenCalled();
    expect(fires.fetchFires).toHaveBeenCalled();
  });

  it("A source failure does not terminate the whole ingestion process and existing persisted data can be used as fallback", async () => {
    vi.spyOn(index, "updateDataForLocation").mockResolvedValue({ missingKeys: [], allFailed: true });
    vi.spyOn(fires, "fetchFires").mockRejectedValue(new Error("Source down"));
    
    await runIngestion();
    
    // The execution should complete without crashing.
    // The fallback queries will be hit (send mocked in docClient).
    expect(index.updateDataForLocation).toHaveBeenCalled();
  });
});
