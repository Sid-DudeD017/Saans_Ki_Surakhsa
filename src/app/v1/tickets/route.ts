import { NextRequest, NextResponse } from "next/server";
import { localDeps } from "../../../../services/command-api/localStack";
import { createTicket, listTickets, TicketError } from "../../../../services/command-api/tickets";
import { RateLimiter } from "../../../../services/command-api/rateLimit";
import { officerFrom } from "../../../../services/command-api/authz";

const rateLimiter = new RateLimiter();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rl = rateLimiter.check(ip);
    if (!rl.allowed) return NextResponse.json({ error: { code: "unavailable", message: "Rate limit exceeded" } }, { status: 429 });

    const body = await req.json();
    const deps = await localDeps();
    const res = await createTicket(deps.db, body);
    return NextResponse.json(res.ticket, { status: res.status });
  } catch (e: any) {
    if (e instanceof TicketError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: 400 });
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const rl = rateLimiter.check(ip);
    if (!rl.allowed) return NextResponse.json({ error: { code: "unavailable", message: "Rate limit exceeded" } }, { status: 429 });

    const officer = officerFrom(req);
    const isOfficer = officer !== null && officer.role !== "citizen";
    const userId = req.headers.get("x-user-id") || (officer?.role === "citizen" ? officer.id : undefined);

    if (!isOfficer && !userId) {
      return NextResponse.json({ error: { code: "unauthenticated", message: "Missing authentication" } }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    try {
      const deps = await localDeps();

      const result = await listTickets(deps.db, isOfficer, {
        district: searchParams.get("district") || undefined,
        status: searchParams.get("status") || undefined,
        category: searchParams.get("category") || undefined,
        cursor: searchParams.get("cursor") || undefined,
        limit: parseInt(searchParams.get("limit") || "50"),
        citizenId: !isOfficer ? userId : undefined,
        officerDistrict: isOfficer && officer ? officer.district : undefined,
      });
      return NextResponse.json(result);
    } catch (dbErr: any) {
      // Graceful fallback for serverless hosting environments (e.g. AWS Amplify) without a local PostgreSQL instance
      const { MOCK_CASES } = await import("../../../../src/app/command/mockCases");
      const { mapCaseToTicket } = await import("../../../../services/command-api/ticketMapper");
      const mockTickets = MOCK_CASES.map((d) => mapCaseToTicket({
        id: d.case.id,
        type: d.type,
        district: d.report.district,
        status: d.case.status,
        created_at: d.case.createdAt,
        updated_at: d.case.updatedAt,
        location: d.report.location,
        reporters_count: d.reports,
        description: d.case.recommendationReason,
        evidence: [],
      }, isOfficer));
      return NextResponse.json({ tickets: mockTickets, next_cursor: null, total: mockTickets.length });
    }
  } catch (e: any) {
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}
