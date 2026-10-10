# Optional insert · 15 s · Gurpreet's machines, the shop and a complaint (P1)

**What judges must take away:** the farmer can check his own machines with a photo, see what to rent
before he'd ever burn, and if a promised machine doesn't come, he has a ticket and a real number to call.

This scene isn't in the 3-minute cut yet. It fits after Gurpreet's voice note (0:55), if the team
trims 15 s elsewhere; otherwise use its first shot alone (5 s). Everything on screen is the live app on
the deployed URL; only the cuts are edited.

## Shot list (15 s)

| Time | Picture | Sound | Subtitle (English) |
|---|---|---|---|
| +0–5 s | **Machines** tab. He photographs the Super Seeder; "Looks like a Super Seeder, 86% sure" with the chip already picked; he taps *Rented*, *2 days*, *Add*. "Work it out": the red **Not enough · 61%** card. | Shutter, then a soft tick | "His own machines clear 11 of 18 acres." |
| +5–9 s | **Shop** tab. "Fits your farm" on the Happy Seeder card: "Clears your 7 acres left in about 1 day". Tap *Rent from a CHC*: Demo CHC A, 2 km. | — | "Rent before you burn." |
| +9–15 s | **Help** tab. "The CHC machine didn't come" → *Send complaint* → the green ticket card with its number. Cut to the officer console: a 📣 "Farmer's complaint" in Sangrur's queue. | Phone tap | "If help doesn't come, he has a ticket and a number to call." |

## Numbers on screen (all must match the live app)

| | Value | Where it comes from |
|---|---|---|
| Machine guess | Super Seeder, 86 % | Claude on Bedrock (`photo.py`); in demo mode the contract's example |
| Coverage | 61 %, 11 of 18 acres, 7 left | coverage engine: Super Seeder 2 days × 5.5 acres/day |
| Shop | Happy Seeder clears 7 acres in about 1 day | shop ranking on the same engine (7 acres/day) |
| Subsidy shown | up to ₹1,20,000 for a farmer buying a Super Seeder | CRM Operational Guidelines 2025, Annexure I |
| Numbers to call | 112 · Chief Agriculture Officer Sangrur 01672-234220 · Kisan Call Centre 1800-180-1551 | `infra/config/helplines.json` (official sites, checked 10 Oct 2026) |

The CHC names, distances and rates are **demo data**; say so on the end card, as in the voice-note scene.

## Before recording

- Fill the farm card as Gurpreet (18 acres, 1 tractor, 20 Oct, 9 Nov, village Bhawanigarh) so the
  Shop and Help tabs show his numbers.
- Don't tap *Call* on camera: it would ring a real government office.
- `npm run smoke` step 12 files the same complaint over HTTP, so the officer's 📣 case is there to cut to.
