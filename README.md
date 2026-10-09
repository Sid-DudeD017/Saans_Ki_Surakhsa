# Saans (Saans Ki Surakhsa)

Integrated clean-air intelligence and environmental health platform connecting:
**Air Data → Pollution Event → People Affected → Action/Report → Command → Notification → Outcome**

---

## Architecture Overview (Gate G1 Standard)

The frontend is a single unified **Next.js application at the repository root**. There is no separate Vite application.

Modules are organized as top-level routes inside `src/app/`:

* `/kisan` — **P1 (Kisan Saathi)**: Farmer voice agent, zero-burn straw management, CHC equipment allocation.
* `/shala` — **P2 (Saans Shala)**: School air monitoring, child-friendly Air Buddy advisories, campus pollution incident reports.
* `/ghar` — **P3 (Ghar ki Hawa)**: Indoor air quality modeling, infiltration ratios, clean commute routes.
* `/command` — **P4 (Command Console)**: City-scale case triage, satellite thermal hotspot pairing, municipal squad dispatch.

The shared app shell (`src/app/layout.tsx`), header navigation (`src/components/Header.tsx`), shared UI primitives (`src/components/ui/`), and API client (`src/lib/api.ts`) are owned by **P2**.

---

## Local Development & Verification

### Install Dependencies
```bash
npm install
```

### Run Next.js Development Server
```bash
npm run dev
# Server listening at http://localhost:3000
```

### Type Checking & Automated Tests
```bash
npx tsc --noEmit
npm run test
```

### Production Build
```bash
npm run build
```

### Kisan Saathi screens (P1)
`/kisan` is the farmer's chat (hold the mic to talk, or type), the plan card and `/kisan/status/<session>`. With `NEXT_PUBLIC_USE_MOCKS` on (the default) it plays Gurpreet's conversation from the contract examples. To use the real agent, run it and point the app at it:
```bash
cd services/agent-kisan && SAANS_API_URL=http://localhost:3000 uv run python scripts/serve_scripted.py   # or uvicorn with Bedrock
NEXT_PUBLIC_USE_MOCKS=false NEXT_PUBLIC_API_BASE_URL= KISAN_AGENT_URL=http://127.0.0.1:8001 npm run dev
```
The app forwards `/v1/agent/kisan/*` to `KISAN_AGENT_URL`. `serve_scripted.py` stands in for the language model only (Bedrock is blocked); speech, the read-back, filing to `/v1/complaints` and status are real.

### Complaint intake: the local stack (G5)
`POST /v1/uploads` and `POST /v1/complaints` need PostGIS and LocalStack S3, run in Docker by `infra/compose.yaml`:
```bash
npm run stack          # start PostGIS (127.0.0.1:5433) and LocalStack (127.0.0.1:4566), wait until healthy
npm run smoke:intake   # upload a photo, file a complaint, and check it became one case row in PostGIS
npm run stack:down     # stop them; complaints and cases are kept in the saans-pg volume
```
With the stack up, `npm run dev` serves both routes; tables and the evidence bucket are created on the first request.
A complaint runs `services/workflows/complaint-intake.asl.json` (validate → hash evidence → triage → assign) in-process; on AWS (G7) Step Functions runs the same file. Look at a complaint's progress with:
```bash
docker compose -f infra/compose.yaml exec postgis psql -U saans -d saans -c "SELECT state, event, at FROM workflow_events ORDER BY id DESC LIMIT 10"
```
To run the PostGIS tests: `SAANS_DATABASE_URL=postgres://saans:saans@127.0.0.1:5433/saans npx vitest run services/command-api/intake.stack.test.ts`.

---

## Configuration

Frontend configuration is controlled via environment variables in `.env` (see `.env.example`):

```bash
# Backend REST endpoint (e.g., AWS API Gateway)
NEXT_PUBLIC_API_BASE_URL=

# Toggle between local deterministic fixtures ('true') and live HTTP ('false')
NEXT_PUBLIC_USE_MOCKS=true
```

---

## Deployment (AWS Amplify Hosting)

Amplify Hosting is configured in [`amplify.yml`](./amplify.yml) targeting the root Next.js application build (`.next`).
