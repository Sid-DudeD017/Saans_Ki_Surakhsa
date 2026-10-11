import { NextRequest, NextResponse } from "next/server";
import { localDeps } from "../../../../../services/command-api/localStack";
import { getTicket, TicketError } from "../../../../../services/command-api/tickets";
import { RateLimiter } from "../../../../../services/command-api/rateLimit";
import { officerFrom } from "../../../../../services/command-api/authz";

const rateLimiter = new RateLimiter();

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rl = rateLimiter.check(ip);
    if (!rl.allowed) return NextResponse.json({ error: { code: "too_many_requests", message: "Rate limit exceeded" } }, { status: 429, headers: { 'Retry-After': (rl.retryAfter ?? 60).toString() } });

    const deps = await localDeps();
    const officer = officerFrom(req);
    const isOfficer = officer !== null && officer.role !== "citizen";
    const user = req.headers.get("x-user-id") || (officer?.role === "citizen" ? officer.id : undefined);

    if (!isOfficer && !user) {
      return NextResponse.json({ error: { code: "unauthenticated", message: "Missing authentication" } }, { status: 401 });
    }
    
    const ticket = await getTicket(deps.db, id, isOfficer, user, officer?.district);
    return NextResponse.json({ ticket });
  } catch (e: any) {
    if (e instanceof TicketError) {
      const status = e.code === "not_found" ? 404 : e.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: { code: e.code, message: e.message } }, { status });
    }
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}
