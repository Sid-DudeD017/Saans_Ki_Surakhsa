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
