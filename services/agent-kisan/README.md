# agent-kisan

Kisan Saathi service (P1): the stubble coverage engine and the farmer intake agent.

```bash
uv sync
uv run pytest -q
uv run uvicorn agent_kisan.api:app --reload --port 8001   # API docs at http://localhost:8001/docs
uv run python -m agent_kisan.chat                         # talk to the agent in the terminal
uv run python scripts/smoke_gurpreet.py                   # scripted Punjabi conversation (calls Bedrock)
```

## Endpoints

- `POST /v1/farm/coverage`: paddy area (acre, killa, hectare, or bigha + state), `window_days` or
  `harvest_date` + `wheat_deadline`, machines and days, tractors, rain days, decomposer acres →
  coverage, gap, straw, PM2.5 if burnt, tractor-days and the planning values used.
- `POST /v1/farm/plan`: the same farm plus `harvest_date`, `wheat_deadline`, `village`/`district` or
  `lat`/`lon`, and optional `rain_dates` (omit them to use the Open-Meteo forecast) → coverage, CHC bookings by day with cost after subsidy,
  coverage after booking, what is still `unmet`, and `demo_data` while the CHC list is made up.
- `POST /v1/agent/kisan/messages`: `{session_id?, text, language}` → `{session_id, reply, missing, quick_replies, filed}`.
  Conversations are held in memory for now.

## Agent

Strands on Amazon Bedrock. Tools: `update_farm_profile`, `get_farm_profile`, `estimate_coverage`,
`get_rain_days`, `plan_zero_burn`, `prepare_readback`, `file_resource_gap_report`. The filing rules are enforced in `session.py`, not the
prompt: a request is filed only after a read-back, a later reply from the farmer, and no changes since.

Use the Saans AWS account, not your default profile: `aws configure --profile saans`, then run
everything with `AWS_PROFILE=saans`.

| Setting | Default |
|---|---|
| `AWS_PROFILE` | your default profile; set it to `saans` |
| `KISAN_MODEL_ID` | `in.anthropic.claude-opus-5` (India-only inference) |
| `KISAN_BEDROCK_REGION` | `ap-south-1` |
| `KISAN_CHC_SEED` | `data/seed/chc_demo.json` (made-up CHCs, rates and bookings) |
| `SAANS_API_URL` | unset: filed requests go to `.outbox/support_requests.jsonl` |

## Filing to Saans Command

Each filed `support_request` carries `help_request`: the same request in Command's `HelpRequest`
shape (`src/domain/schemas/index.ts`), built by `help_request.py`. It describes what is still short
after the zero-burn plan (`coveragePercent`, `uncoveredAcres` after booking, `machineType` to send),
with `ownCoveragePercent` and `plannedBookings` as extra fields. `farmLocation` comes from the
phone's GPS, else the village, else the district centre in `data/seed`. Without any of those,
`help_request` is null and `help_request_error` says why.

## Simulated farmers

```bash
AWS_PROFILE=saans uv run python -m agent_kisan.evals --n 20     # start with 20 and check the cost
```

Claude Haiku 4.5 plays farmers with hidden true answers (Punjabi, Hindi, English and mixed; words or
digits; one-at-a-time, all-at-once or rambling; some correct themselves or start with a vague date).
Scores per farmer: each of 8 details right, filed correctly, filed with a wrong detail, coverage
error, turns, and whether the agent asked for Aadhaar or bank details. Results land in
`evals/results/<time>/` (git-ignored) with a summary broken down by language and behaviour.

## Number guard

`numbers.py` reads numbers in what the farmer said: digits in any script and number words in
Punjabi, Hindi, romanised and English (0–50, tens to 100, dedh, dhai, sava, saadhe, paune, sau).
Each is tagged by the word next to it: area, tractors, days or a month. `guard.py` then checks that
every number the model recorded was said for that kind of thing. Unsure numbers block the read-back
and come back as `quick_replies`; tapping one sends its text, which contains the number. The word
tables need a native speaker's check.

## Rain days

`weather.py` reads Open-Meteo's 16-day daily rain forecast for the farm (free, no key, cached 3 h).
A day with 5 mm or more is a rain day, and a day of 20 mm or more also loses the next day: planning
values to check with the KVK. Days past the forecast are assumed dry and the reply says so. If the
forecast fails, the plan goes ahead as if dry. P3 owns the shared Open-Meteo client; swap it in later.

## Zero-burn planner

`planner.py` books free, dry days at CHCs within 15 km (or in the same district when the farm's
location is unknown), cheapest per acre after subsidy first, then nearest, then earliest. What it
can't book becomes `unmet`, the help request. If the CHC data can't load, the whole gap is filed as
unmet, so filing still works. Days before today are never booked. Demo assumption: a CHC rental brings its own tractor and operator.

Capacities in `coverage.py`, bigha sizes in `units.py` and everything in `data/seed/chc_demo.json`
are placeholders until KVK figures come in.
