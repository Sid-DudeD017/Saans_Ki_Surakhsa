import { NextRequest, NextResponse } from "next/server";
import { localDeps } from "../../../../../../services/command-api/localStack";
import { applyTicketAction, TicketError } from "../../../../../../services/command-api/tickets";
import { RateLimiter } from "../../../../../../services/command-api/rateLimit";

const rateLimiter = new RateLimiter();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, action: string }> }) {
  try {
    const { id, action } = await params;
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const user = req.headers.get("x-user-id") || "anonymous";
    
    const rl = rateLimiter.check(ip, user);
    if (!rl.allowed) return NextResponse.json({ error: { code: "unavailable", message: "Rate limit exceeded" } }, { status: 429 });

    const body = await req.json();
    body.action = action; // override action from path

    const deps = await localDeps();
    const isOfficer = req.headers.get("authorization") ? true : false;
    const actor = isOfficer ? "officer-x" : user; // simplistic auth parsing for demo
    
    const ticket = await applyTicketAction(deps.db, id, body, actor, isOfficer);
    return NextResponse.json({ ticket });
  } catch (e: any) {
    if (e instanceof TicketError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.code === "not_found" ? 404 : 400 });
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}
