import { NextRequest, NextResponse } from "next/server";
import { localDeps } from "../../../../../../services/command-api/localStack";
import { applyTicketAction, TicketError } from "../../../../../../services/command-api/tickets";
import { RateLimiter } from "../../../../../../services/command-api/rateLimit";

const rateLimiter = new RateLimiter();

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string, action: string }> }) {
  try {
    const { id, action } = await params;
    const ip = req.headers.get("x-forwarded-for") || "127.0.0.1";
    // Real production app would use an auth token, but in dev we use a header
    const user = process.env.NODE_ENV === "production" ? "anonymous" : (req.headers.get("x-user-id") || "anonymous");
    
    const rl = rateLimiter.check(ip, user);
    if (!rl.allowed) return NextResponse.json({ error: { code: "too_many_requests", message: "Rate limit exceeded" } }, { status: 429, headers: { 'Retry-After': (rl.retryAfter ?? 60).toString() } });

    const body = await req.json().catch(() => ({}));
    body.action = action; // override action from path

    const deps = await localDeps();
    const isOfficer = req.headers.get("authorization") ? true : false;
    const actor = isOfficer ? "officer-x" : user; 
    
    if (!isOfficer && user === "anonymous") {
        return NextResponse.json({ error: { code: "unauthenticated", message: "Missing authentication" } }, { status: 401 });
    }
    
    const ticket = await applyTicketAction(deps.db, id, body, actor, isOfficer);
    return NextResponse.json({ ticket });
  } catch (e: any) {
    let status = 400;
    if (e instanceof TicketError) {
      if (e.code === "not_found") status = 404;
      else if (e.code === "forbidden") status = 403;
      else if (e.code === "conflict") status = 409;
      return NextResponse.json({ error: { code: e.code, message: e.message } }, { status });
    }
    return NextResponse.json({ error: { code: "invalid_request", message: e.message } }, { status: 400 });
  }
}
