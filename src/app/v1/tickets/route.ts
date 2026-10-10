import { NextRequest, NextResponse } from "next/server";
import { localDeps } from "../../../../services/command-api/localStack";
import { createTicket, listTickets, TicketError } from "../../../../services/command-api/tickets";
import { RateLimiter } from "../../../../services/command-api/rateLimit";

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

    const { searchParams } = new URL(req.url);
    const deps = await localDeps();
    
    const isOfficer = req.headers.get("authorization") ? true : false;
    
    const tickets = await listTickets(deps.db, isOfficer, {
      district: searchParams.get("district") || undefined,
      status: searchParams.get("status") || undefined,
    });
    return NextResponse.json({ tickets });
  } catch (e: any) {
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}
