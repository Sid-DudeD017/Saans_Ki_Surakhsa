// Forwards a request to the Kisan Saathi agent at KISAN_AGENT_URL (P1), so the app reaches the agent
// through this site like everything else it serves: /v1/agent/kisan/*, /v1/farm/* and /v1/chcs.
const AGENT = (process.env.KISAN_AGENT_URL || 'http://127.0.0.1:8001').replace(/\/$/, '');
const PASSED = ['content-type', 'accept', 'accept-language'];
const RETURNED = ['content-type', 'cache-control', 'content-length'];

/** `path` is the agent's own path, already encoded, e.g. "/v1/farm/coverage". */
export async function forwardToAgent(request: Request, path: string): Promise<Response> {
  const url = new URL(request.url);
  const headers = new Headers();
  for (const name of PASSED) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let upstream: Response;
  try {
    upstream = await fetch(`${AGENT}${path}${url.search}`, {
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

export const segments = (path: string[]) => path.map(encodeURIComponent).join('/');
