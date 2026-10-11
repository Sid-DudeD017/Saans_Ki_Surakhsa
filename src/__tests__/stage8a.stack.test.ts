import { describe, expect, it } from 'vitest';
import { POST, GET } from '../app/v1/tickets/route';
import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';

describe('Stage 8a Submit to Ticket Flow', () => {
  it('creates a ticket and then gets it, verifying response shapes and 401 error case', async () => {
    // 1. Create a ticket
    const payload = {
      type: 'garbage',
      district: 'Sangrur',
      reporter_identity: 'Citizen Test',
      reporter_consent: true,
      idempotency_key: `cit-test-${randomUUID()}`
    };

    const postReq = new NextRequest('http://localhost:3000/v1/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const postRes = await POST(postReq);
    expect(postRes.status).toBe(201);
    
    const postData = await postRes.json();
    
    // VERIFY DEFENSIVE FIX: POST response is the ticket object itself, so .id must exist directly on the body.
    expect(postData.id).toBeDefined();
    expect(postData.ticket).toBeUndefined();
    
    const ticketId = postData.id;

    // 2. Error case: GET without valid auth header should return 401 or 403
    // In our mock logic or actual logic, if x-user-id is 'anonymous', it should return 401?
    // Wait, let's just omit the header for 401.
    const getReqNoAuth = new NextRequest(`http://localhost:3000/v1/tickets/${ticketId}`, {
      method: 'GET'
    });
    // Wait, the API route for GET /v1/tickets/[id] is in src/app/v1/tickets/[id]/route.ts
    // Let's import it dynamically to test it.
    const { GET: getTicket } = await import('../app/v1/tickets/[id]/route');

    const getResNoAuth = await getTicket(getReqNoAuth, { params: Promise.resolve({ id: ticketId }) });
    expect(getResNoAuth.status).toBe(401);
    const noAuthData = await getResNoAuth.json();
    expect(noAuthData.error.code).toBe('unauthenticated');

    // 3. Load the ticket successfully
    const getReqAuth = new NextRequest(`http://localhost:3000/v1/tickets/${ticketId}`, {
      method: 'GET',
      headers: { 'x-user-id': 'Citizen Test' }
    });
    
    const getResAuth = await getTicket(getReqAuth, { params: Promise.resolve({ id: ticketId }) });
    expect(getResAuth.status).toBe(200);
    const authData = await getResAuth.json();
    
    // VERIFY DEFENSIVE FIX: GET response is { ticket: { id: ... } }
    expect(authData.ticket).toBeDefined();
    expect(authData.ticket.id).toBe(ticketId);
    expect(authData.id).toBeUndefined();
  });
});
