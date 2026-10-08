// POST /v1/uploads: a presigned S3 PUT for one photo or voice note. The URL is signed with the file's
// sha256, so S3 refuses any bytes but the ones declared, and it expires after 15 minutes.
import { randomUUID } from "node:crypto";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import type { IntakeDeps } from "./deps";
import type { UploadInput } from "./inputs";
import { indiaTime } from "./time";

const EXTENSIONS: Record<UploadInput["media_type"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/heic": "heic",
  "audio/mp4": "m4a",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

export interface UploadTarget {
  object_key: string;
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
  expires_at: string;
}

export function base64Sha256(hex: string) {
  return Buffer.from(hex, "hex").toString("base64");
}

export async function createUpload(deps: IntakeDeps, input: UploadInput): Promise<UploadTarget> {
  const now = deps.now();
  const day = indiaTime(now).slice(0, 10).replaceAll("-", "/");
  const objectKey = `evidence/${day}/${randomUUID()}.${EXTENSIONS[input.media_type]}`;
  const ttl = deps.config.uploadTtlSeconds;
  const headers = {
    "Content-Type": input.media_type,
    "x-amz-checksum-sha256": base64Sha256(input.sha256),
  };

  const uploadUrl = await getSignedUrl(
    deps.s3,
    new PutObjectCommand({
      Bucket: deps.config.evidenceBucket,
      Key: objectKey,
      ContentType: input.media_type,
      ChecksumSHA256: headers["x-amz-checksum-sha256"],
    }),
    {
      expiresIn: ttl,
      signingDate: now,
      // Sent as headers, not query parameters, so the uploader must send exactly these.
      signableHeaders: new Set(["content-type", "x-amz-checksum-sha256"]),
      unhoistableHeaders: new Set(["x-amz-checksum-sha256"]),
    },
  );

  const expiresAt = new Date(now.getTime() + ttl * 1000);
  await deps.db.query(
    `INSERT INTO uploads (object_key, media_type, byte_size, sha256, expires_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [objectKey, input.media_type, input.byte_size, input.sha256, expiresAt, now],
  );
  return { object_key: objectKey, upload_url: uploadUrl, method: "PUT", headers, expires_at: indiaTime(expiresAt) };
}
