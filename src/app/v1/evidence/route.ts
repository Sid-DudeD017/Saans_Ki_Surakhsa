import { NextRequest, NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { localDeps } from "../../../../services/command-api/localStack";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get("key");

    if (!key || !key.startsWith("evidence/")) {
      return NextResponse.json(
        { error: { code: "invalid_request", message: "Missing or invalid evidence key" } },
        { status: 400 }
      );
    }

    const deps = await localDeps();
    const command = new GetObjectCommand({
      Bucket: deps.config.evidenceBucket,
      Key: key,
    });

    const s3Res = await deps.s3.send(command);
    if (!s3Res.Body) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Evidence file not found" } },
        { status: 404 }
      );
    }

    const bytes = await s3Res.Body.transformToByteArray();
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": s3Res.ContentType || "image/jpeg",
        "Content-Length": String(bytes.length),
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: any) {
    if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Evidence file not found in storage" } },
        { status: 404 }
      );
    }
    console.error("Evidence fetch failed:", err);
    return NextResponse.json(
      { error: { code: "internal_error", message: err.message } },
      { status: 500 }
    );
  }
}
