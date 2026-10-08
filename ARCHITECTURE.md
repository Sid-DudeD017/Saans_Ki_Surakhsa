# Saans Architecture Specification (Gates G0 → G1 Standard)

## 1. Unified Application Architecture

Per the G1 team architecture decision:

```text
Frontend
   ↓
Next.js application at repository root
   ↓
├── /kisan    (P1 Owned — Farmer speech agent & zero-burn planner)
├── /shala    (P2 Owned — School air quality & child health)
├── /ghar     (P3 Owned — Indoor air & personal exposure model)
└── /command  (P4 Owned — Municipal incident triage & response dispatch)
```

**Architectural Rules**:
* The Next.js application at the repository root is the **single unified web application**.
* There is **no separate Vite application** and no `apps/saans` directory.
* All modules live as first-class routes inside `src/app/`.
* A shared root layout (`src/app/layout.tsx`) hosts the common branding, real-time AQI indicator, active persona/role selector, multilingual switch, and incident reporting triggers.

---

## 2. P2 Ownership & Boundary

P2 owns:
1. **Shared App Shell**: Root layout (`src/app/layout.tsx`), header navigation (`src/components/Header.tsx`), and persistent floating report CTA (`src/components/ReportButton.tsx`).
2. **Saans Shala Module Route**: `src/app/shala/page.tsx` (school dashboard, Air Buddy placeholder, campus advisory, and complaint submission flow).
3. **Shared Design System / UI Primitives**: `src/components/ui/` (`Button`, `Card`, `Alert`, `Badge`, `Container`, `LanguageSwitcher`). Generic and reusable by P1, P3, and P4.
4. **Frontend API Client**: `src/lib/api.ts` (strongly-typed abstraction supporting live HTTP or deterministic local mocks).
5. **AWS Amplify Hosting**: Continuous deployment configuration (`amplify.yml`) targeting the root Next.js build.

---

## 3. Frontend Environment Configuration

The frontend client in `src/lib/api.ts` reads the following environment variables:

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Root URL for backend REST API (e.g. AWS API Gateway) | `""` (empty) |
| `NEXT_PUBLIC_USE_MOCKS` | Set to `"true"` to use deterministic local fixtures; `"false"` to execute live HTTP fetch | `"true"` |

### Decision Flow:
```text
NEXT_PUBLIC_USE_MOCKS === 'true' (or unset)
        ↓
Local typed mock implementation (src/lib/mockData.ts)

NEXT_PUBLIC_USE_MOCKS === 'false'
        ↓
HTTP fetch to ${NEXT_PUBLIC_API_BASE_URL}/v1/...
```

---

## 4. Module Boundaries & Routing

| Route | Owning Teammate | Purpose |
|---|---|---|
| `/` | Shared (P2 Shell) | Platform overview, regional AQI corridor status, and module gateways |
| `/kisan` | **P1 (Kisan Saathi)** | Farmer speech agent, zero-burn straw management, CHC equipment booking |
| `/shala` | **P2 (Saans Shala)** | School air monitoring, Air Buddy mascot advice, student/teacher incident reports |
| `/ghar` | **P3 (Ghar ki Hawa)** | Indoor air quality estimation, infiltration modeling, clean commute routing |
| `/command` | **P4 (Command Console)** | Municipal case triage, satellite thermal hotspot pairing, response team dispatch |

---

## 5. Deployment Specification (AWS Amplify)

* **Deployment Target**: AWS Amplify Hosting.
* **Build Configuration**: Configured in root `amplify.yml`.
* **Artifact Directory**: `.next` (Next.js production build output).
* **Build Command**: `npm run build` (runs `next build`).
