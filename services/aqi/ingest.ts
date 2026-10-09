import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { fetchFires } from "./fires";
import { updateDataForLocation, getAqiForLocation } from "./index";
import { liveDeps, refreshForecast } from "./forecast/service";

const S3_BUCKET = "saans-raw-data";
const DDB_TABLE = "saans_ingestion";

export const s3 = new S3Client({
  endpoint: process.env.LOCALSTACK_URL || "http://127.0.0.1:4566",
  region: "ap-south-1",
  forcePathStyle: true,
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});

const ddbClient = new DynamoDBClient({
  endpoint: process.env.LOCALSTACK_URL || "http://127.0.0.1:4566",
  region: "ap-south-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" }
});
export const docClient = DynamoDBDocumentClient.from(ddbClient);

export async function setupAws() {
  try {
    const tables = await ddbClient.send(new ListTablesCommand({}));
    if (!tables.TableNames?.includes(DDB_TABLE)) {
      await ddbClient.send(new CreateTableCommand({
        TableName: DDB_TABLE,
        KeySchema: [
          { AttributeName: "pk", KeyType: "HASH" },
          { AttributeName: "sk", KeyType: "RANGE" }
        ],
        AttributeDefinitions: [
          { AttributeName: "pk", AttributeType: "S" },
          { AttributeName: "sk", AttributeType: "S" }
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }));
    }
  } catch (e) {
    // Ignore AWS setup errors if LocalStack is not running
  }
}

export async function runIngestion() {
  await setupAws();
  
  const timestamp = new Date().toISOString();
  
  // 1. AQI Ingestion
  const lat = 28.6139;
  const lon = 77.2090;
  try {
    const keys = { openaq: process.env.OPENAQ_API_KEY, cpcb: process.env.CPCB_API_KEY };
    const { allFailed } = await updateDataForLocation(lat, lon, keys);
    
    if (allFailed) {
      console.warn("AQI sources failed. Attempting fallback.");
      try {
        const res = await docClient.send(new QueryCommand({
          TableName: DDB_TABLE,
          KeyConditionExpression: "pk = :pk",
          ExpressionAttributeValues: { ":pk": `aqi#${lat.toFixed(2)}#${lon.toFixed(2)}` },
          ScanIndexForward: false, // get latest
          Limit: 1
        }));
        if (res.Items && res.Items.length > 0) {
          console.log("Fallback AQI data found:", res.Items[0].sk);
        } else {
          console.warn("No fallback AQI data available.");
        }
      } catch (e) {
        console.warn("Fallback query failed.");
      }
    } else {
      const aqiData = await getAqiForLocation(lat, lon);
      if (aqiData) {
        // Save structured data to DDB
        await docClient.send(new PutCommand({
          TableName: DDB_TABLE,
          Item: {
            pk: `aqi#${lat.toFixed(2)}#${lon.toFixed(2)}`,
            sk: timestamp,
            ingested_at: timestamp,
            data_timestamp: aqiData.data_timestamp,
            data: aqiData
          }
        })).catch(() => {});
        
        // Save raw to S3
        await s3.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: `aqi/${timestamp}.json`,
          Body: JSON.stringify(aqiData)
        })).catch(() => {});
      }
    }
  } catch (e) {
    console.error("AQI ingestion error", e);
  }

  // 2. Fires Ingestion
  const bbox = "77.0,28.0,78.0,29.0";
  try {
    const mapKey = process.env.NASA_FIRMS_MAP_KEY;
    if (!mapKey) throw new Error("Missing FIRMS key");
    
    const fires = await fetchFires(bbox, mapKey);
    
    // S3 raw
    await s3.send(new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: `fires/${timestamp}.json`,
      Body: JSON.stringify(fires)
    })).catch(() => {});
    
    // DDB structured
    await docClient.send(new PutCommand({
      TableName: DDB_TABLE,
      Item: {
        pk: `fires#${bbox}`,
        sk: timestamp,
        ingested_at: timestamp,
        count: fires.length,
        fires: fires
      }
    })).catch(() => {});
    
  } catch (e) {
    console.warn("FIRMS source failed. Attempting fallback.");
    try {
      const res = await docClient.send(new QueryCommand({
        TableName: DDB_TABLE,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": `fires#${bbox}` },
        ScanIndexForward: false,
        Limit: 1
      }));
      if (res.Items && res.Items.length > 0) {
        console.log("Fallback Fire data found:", res.Items[0].sk);
      } else {
        console.warn("No fallback Fire data available.");
      }
    } catch (err) {
      console.warn("Fallback query failed.");
    }
  }

  // 3. Forecast grid, rebuilt when the stored one is 3 hours old
  try {
    const { store, build } = liveDeps();
    console.log("Forecast grid:", await refreshForecast({ store, build }));
  } catch (e) {
    console.warn("Forecast grid refresh failed.", e instanceof Error ? e.message : e);
  }
}
