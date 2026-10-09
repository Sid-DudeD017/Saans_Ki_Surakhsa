// /v1/agent/kisan/* (P1): forwards to the Kisan Saathi agent at KISAN_AGENT_URL, so the app reaches the
// agent through the same API base URL as everything else. Deployed, the API gateway routes these paths
// straight to the agent instead.
const AGENT = (process.env.KISAN_AGENT_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
const PASSED = ['content-type', 'accept', 'accept-language'];
const RETURNED = ['content-type', 'cache-control', 'content-length'];

export const runtime = 'nodejs';

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const url = new URL(request.url);
  const target = `${AGENT}/v1/agent/kisan/${path.map(encodeURIComponent).join('/')}${url.search}`;
  const headers = new Headers();
  for (const name of PASSED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
      cache: 'no-store',
    });
  } catch {
    return Response.json(
      { error: { code: 'unavailable', message: `Kisan Saathi isn't running at ${AGENT}; start it (services/agent-kisan) or set KISAN_AGENT_URL` } },
      { status: 503 },
    );
  }
  const out = new Headers();
  for (const name of RETURNED) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export const GET = forward;
export const POST = forward;
