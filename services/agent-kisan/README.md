# agent-kisan

Kisan Saathi service (P1): the stubble coverage engine and the farmer intake agent.

```bash
uv sync
uv run pytest -q
uv run uvicorn agent_kisan.api:app --reload --port 8001   # API docs at http://localhost:8001/docs
uv run python scripts/serve_scripted.py                   # same API, Gurpreet's scripted conversation instead of Bedrock
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
- `GET /v1/chcs?village=…|lat=…&lon=…|district=…&machine=…`: CHCs within 15 km, nearest first, with
  price per acre after subsidy and phone.
- `GET /v1/farm/fires?lat=…&lon=…&radius_km=5`: satellite fire points (NASA FIRMS, last day) within
  `radius_km` (up to 25) of a farm, nearest first, through P3's `/v1/fires`; 503 if P3's service can't answer.
- `POST /v1/agent/kisan/voice`: multipart `audio` (m4a, wav, ogg, mp3, up to 10 MB) plus optional
  `session_id` and `language` → the same reply as a message, with the `transcript`.
- `POST /v1/agent/kisan/photo`: multipart `photo` (+ optional `session_id`) → location and time from the
  photo, a stored copy with faces blurred and no metadata, and the machine it shows (Claude on Bedrock).
- `GET /v1/agent/kisan/sessions/{id}/readback.wav`: the current read-back spoken in Punjabi or Hindi.
- `GET /v1/agent/kisan/sessions/{id}/status`: the farmer's status page (filed, seen, machine assigned, done).
- `POST /v1/agent/kisan/help-requests/{id}/status`: for Command, with `X-Saans-Service-Token`; texts the farmer.
- `POST /v1/allocations`: for Command: shares CHC machines across open `HelpRequest`s
  (earliest wheat deadline first, nearest machine first, one farm per machine per day).
- `POST /v1/agent/kisan/messages`: `{session_id?, text, language}` → `{session_id, reply, missing, quick_replies, filed}`.
  Conversations are held in memory for now.

## Agent

Strands on Amazon Bedrock. Tools: `update_farm_profile`, `get_farm_profile`, `estimate_coverage`,
`get_rain_days`, `find_chc`, `get_fires_near_farm`, `plan_zero_burn`, `prepare_readback`, `file_resource_gap_report`. The filing rules are enforced in `session.py`, not the
prompt: a request is filed only after a read-back, a later reply from the farmer, and no changes since.

Use the Saans AWS account, not your default profile: `aws configure --profile saans`, then run
everything with `AWS_PROFILE=saans`.

| Setting | Default |
|---|---|
| `AWS_PROFILE` | your default profile; set it to `saans` |
| `KISAN_MODEL_ID` | `in.anthropic.claude-opus-5` (India-only inference) |
| `KISAN_BEDROCK_REGION` | `ap-south-1` |
| `KISAN_CHC_SEED` | `data/seed/chc_demo.json` (made-up CHCs, rates and bookings) |
| `SAANS_API_URL` | unset: filed requests go to `.outbox/support_requests.jsonl`. A base URL without `/v1` |
| `SAANS_AQI_URL` | unset: no fire data. P3's service, locally the Next.js app at `http://localhost:3000` |

Every setting, with what it does, is in the repo's `.env.example`.

## Filing to Saans Command

With `SAANS_API_URL` set, Kisan posts to Command's `POST /v1/complaints` with an `Idempotency-Key`
equal to the session id. The body is Command's `ComplaintInput` with `type: farmer_support`
(`schemas.FarmerSupportComplaint`): the farm's `location`, an empty `evidence` list, the
`support_request` (farm, coverage, `plan[]`, `unmet[]`, `nearby_fires`) and `help_request`. A farm
with no location at all can't be sent to Command and stays an error for the agent to resolve.
Timestamps are India time with `+05:30`.

Each filed `support_request` carries `help_request`: the same request in Command's `HelpRequest`
shape (`src/domain/schemas/index.ts`), built by `help_request.py`. It describes what is still short
after the zero-burn plan (`coveragePercent`, `uncoveredAcres` after booking, `machineType` to send),
with `ownCoveragePercent` and `plannedBookings` as extra fields. `farmLocation` comes from the
phone's GPS, else the village, else the district centre in `data/seed`. Without any of those,
`help_request` is null and `help_request_error` says why.

The contract is tested on both sides: `python -m agent_kisan.contract_fixtures` writes example
requests to `packages/contracts/fixtures/kisan-help-requests.json`, `src/__tests__/kisan-help-request.test.ts`
parses them with Command's real `HelpRequestSchema` (`npx vitest run`), and a Python test fails
if the fixture is out of date.

## The contract

`packages/contracts/proposals/p1-kisan.openapi.json` is generated from this API, so it can't drift:

```bash
uv run python -m agent_kisan.contract
```

Errors are P4's `ErrorEnvelope` (`{"error": {"code", "message", "details"}}`), FastAPI's own validation
errors included, and the proposal points every error response at P4's schema.

Every route has a response model (`schemas.py`), so FastAPI checks each reply against the contract,
and every JSON response in the file has an example made by calling the route on Gurpreet's demo
story (a scripted conversation stands in for Bedrock). `tests/test_contract.py` fails if the file is
out of date. Operation ids are the route functions' names.

## Deploying

```bash
docker build -f services/agent-kisan/Dockerfile -t saans-agent-kisan .   # from the repo root
AWS_PROFILE=saans services/agent-kisan/deploy/deploy.sh                   # ECR + App Runner, costs money
AWS_PROFILE=saans services/agent-kisan/deploy/teardown.sh                 # list what's running
AWS_PROFILE=saans services/agent-kisan/deploy/teardown.sh --yes           # delete it all (Sunday)
```

`deploy/apprunner.yaml` runs one instance (conversations are in memory), 1 vCPU / 2 GB, health check
on `/healthz`, with an instance role that may only call Bedrock. Set `SAANS_API_URL` before
deploying to file to Command; otherwise requests go to an outbox inside the container.

## Simulated farmers

```bash
AWS_PROFILE=saans uv run python -m agent_kisan.evals --n 20     # start with 20 and check the cost
```

Claude Haiku 4.5 plays farmers with hidden true answers (Punjabi, Hindi, English and mixed; words or
digits; one-at-a-time, all-at-once or rambling; some correct themselves or start with a vague date).
Scores per farmer: each of 8 details right, filed correctly, filed with a wrong detail, coverage
error, turns, and whether the agent asked for Aadhaar or bank details. Results land in
`evals/results/<time>/` (git-ignored) with a summary broken down by language and behaviour.

## Voice notes

`transcribe.py` turns voice notes into text with Whisper. `KISAN_ASR_BACKEND=local` (the default)
runs faster-whisper on your machine with `large-v3-turbo` (about 1.6 GB, downloaded on first use;
`KISAN_ASR_MODEL` picks another); `sagemaker` calls `KISAN_ASR_ENDPOINT` (written, not yet tried
against a live endpoint). Local Whisper is in the `asr` dependency group, which the deployed image
leaves out. On a MacBook Air a short Hindi note takes about 7–8 s.

Number words Whisper heard with low probability don't count as heard, so the farmer is asked to
confirm them: this catches some speech mistakes, not only the model's. The word tables include
Whisper's own Hindi spellings (एकर, ट्रक्तर, अक्तोबर, धाई for ढाई). Not yet tried on Punjabi audio.

### Results

<!-- EVAL RESULTS START -->
Not run yet: the AWS account can't reach Bedrock. After a run: `uv run python scripts/eval_to_readme.py`.
<!-- EVAL RESULTS END -->

## Read-back card and voice

When the agent reads the details back, the reply carries `readback`: a card (big digits, icon keys
for P2's screens), the spoken script, and `audio_url`. `tts.py` speaks Punjabi and Hindi with Meta's
MMS voices (CC-BY-NC), sentence by sentence, starting in the background as soon as the read-back
exists, and caches it. On a laptop it takes ~2.5 s; on App Runner's 1 vCPU ~30 s, so the head start
matters. One-word clips stitched together were tried first and dropped: unintelligible. The phrasing
needs a native speaker's check.

## SMS

`notify.py` keeps each request's status history and texts the farmer (`farmer_phone`, +91) when it's
filed, when Command assigns a machine and when the work is done: SNS with `KISAN_SMS=sns`
(and `KISAN_SMS_SENDER_ID` once DLT-registered), else `.outbox/sms.jsonl`. Command's updates need
`KISAN_SERVICE_TOKEN` set on both sides. The templates in `notify.py` are the ones to register for DLT.

## Video

`video/scene-0020-gurpreet.md`: shot list, lines and checklist for the 0:20–0:55 scene.

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

## Fires near the farm

`fires.py` asks P3's `GET /v1/fires` for the box around the farm, keeps the points inside the circle
(5 km by default), nearest first, and normalises confidence (VIIRS l/n/h, MODIS 0–100) to low, nominal
or high. It needs the phone's location or a known village: a district centre is too far off. Results are
cached for 30 minutes. The last check is filed with the help request (`nearby_fires`, and `nearbyFires`
in Command's HelpRequest) so the officer sees that fires are already being seen around the farm.
A fire pixel is 375 m across and can be a neighbour's field, so the agent never suggests the farmer
burned, and mentions fires only if the farmer asks about smoke.

## Zero-burn planner

`planner.py` books free, dry days at CHCs within 15 km (or in the same district when the farm's
location is unknown), cheapest per acre after subsidy first, then nearest, then earliest. What it
can't book becomes `unmet`, the help request. If the CHC data can't load, the whole gap is filed as
unmet, so filing still works. Days before today are never booked. Demo assumption: a CHC rental brings its own tractor and operator.

Capacities in `coverage.py`, bigha sizes in `units.py` and everything in `data/seed/chc_demo.json`
are placeholders until KVK figures come in.
