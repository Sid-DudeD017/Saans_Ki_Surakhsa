import { NextRequest, NextResponse } from "next/server";
import { localDeps } from "../../../../../services/command-api/localStack";
import { getTicket, TicketError } from "../../../../../services/command-api/tickets";
import { RateLimiter } from "../../../../../services/command-api/rateLimit";

const rateLimiter = new RateLimiter();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rl = rateLimiter.check(ip);
    if (!rl.allowed) return NextResponse.json({ error: { code: "unavailable", message: "Rate limit exceeded" } }, { status: 429 });

    const deps = await localDeps();
    const isOfficer = req.headers.get("authorization") ? true : false;
    
    const ticket = await getTicket(deps.db, id, isOfficer);
    return NextResponse.json({ ticket });
  } catch (e: any) {
    if (e instanceof TicketError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.code === "not_found" ? 404 : 400 });
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}
