// Where the forecast grid is kept (P3): S3, as forecast/latest.json plus a copy per build. LocalStack locally.
import { CreateBucketCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import type { ForecastSnapshot } from './grid';

export interface ForecastStore {
  load(): Promise<ForecastSnapshot | null>;
  save(snapshot: ForecastSnapshot): Promise<void>;
}

export function memoryStore(initial: ForecastSnapshot | null = null): ForecastStore & { saved: ForecastSnapshot[] } {
  let latest = initial;
  const saved: ForecastSnapshot[] = [];
  return {
    saved,
    async load() {
      return latest;
    },
    async save(s) {
      latest = s;
      saved.push(s);
    },
  };
}

const LATEST = 'forecast/latest.json';

function client(): S3Client {
  // LocalStack unless we're running in AWS (Lambda sets AWS_EXECUTION_ENV), as services/aqi/ingest.ts does.
  const endpoint = process.env.LOCALSTACK_URL ?? (process.env.AWS_EXECUTION_ENV ? undefined : 'http://127.0.0.1:4566');
  return new S3Client({
    region: process.env.AWS_REGION ?? 'ap-south-1',
    // Fail fast: when the store is down, the API builds the grid itself.
    maxAttempts: 1,
    requestHandler: { connectionTimeout: 1000, requestTimeout: 10_000 },
    ...(endpoint ? { endpoint, forcePathStyle: true, credentials: { accessKeyId: 'test', secretAccessKey: 'test' } } : {}),
  });
}

export function s3Store(bucket = process.env.SAANS_RAW_BUCKET ?? 'saans-raw-data', s3 = client()): ForecastStore {
  const put = async (s: ForecastSnapshot) => {
    const body = JSON.stringify(s);
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: LATEST, Body: body, ContentType: 'application/json' }));
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `forecast/${s.generated_at}.json`, Body: body, ContentType: 'application/json' }));
  };
  return {
    async load() {
      try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: LATEST }));
        const text = await res.Body?.transformToString();
        const s = text ? (JSON.parse(text) as ForecastSnapshot) : null;
        return s?.version === 1 ? s : null;
      } catch {
        return null; // no grid yet, or no store
      }
    },
    async save(s) {
      try {
        await put(s);
      } catch (e) {
        if ((e as { name?: string }).name !== 'NoSuchBucket') throw e;
        await s3.send(new CreateBucketCommand({ Bucket: bucket, CreateBucketConfiguration: { LocationConstraint: 'ap-south-1' } }));
        await put(s);
      }
    },
  };
}
