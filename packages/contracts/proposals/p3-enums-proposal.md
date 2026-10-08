# P3 Enums & Wire-Format Proposal

> **Author:** P3 · **Status:** Proposal for P4 to adopt into `CONVENTIONS.md`

---

## 1  Rule — Enum Wire Format

All enum values transmitted over the API **MUST** be lowercase `snake_case` codes.
Display labels (English, Hindi, Punjabi, or any other language) **NEVER** appear in
API request or response bodies.  Labels are resolved in the UI at render time from a
single constants file (suggested: `src/lib/labels.ts`, owned by P2).

---

## 2  Enum Tables

### 2.1  `pollutant`

| Code   | English          | Hindi (VERIFY)       | Punjabi (VERIFY)      |
|--------|------------------|----------------------|-----------------------|
| `pm25` | PM 2.5           | पीएम 2.5             | ਪੀਐਮ 2.5               |
| `pm10` | PM 10            | पीएम 10              | ਪੀਐਮ 10                |
| `no2`  | Nitrogen Dioxide | नाइट्रोजन डाइऑक्साइड | ਨਾਈਟ੍ਰੋਜਨ ਡਾਈਆਕਸਾਈਡ    |
| `so2`  | Sulphur Dioxide  | सल्फर डाइऑक्साइड     | ਸਲਫਰ ਡਾਈਆਕਸਾਈਡ        |
| `co`   | Carbon Monoxide  | कार्बन मोनोऑक्साइड   | ਕਾਰਬਨ ਮੋਨੋਆਕਸਾਈਡ      |
| `o3`   | Ozone            | ओज़ोन                | ਓਜ਼ੋਨ                  |
| `nh3`  | Ammonia          | अमोनिया              | ਅਮੋਨੀਆ                |
| `pb`   | Lead             | सीसा                 | ਸੀਸਾ                  |

### 2.2  `aqi_category`

| Code            | AQI Band  | English (display)      | Hindi (VERIFY)          | Punjabi (VERIFY)        |
|-----------------|-----------|------------------------|-------------------------|-------------------------|
| `good`          | 0 – 50    | Good                   | अच्छा                   | ਵਧੀਆ                    |
| `satisfactory`  | 51 – 100  | Satisfactory           | संतोषजनक                | ਤਸੱਲੀਬਖ਼ਸ਼                |
| `moderate`      | 101 – 200 | Moderately polluted    | मध्यम प्रदूषित           | ਦਰਮਿਆਨਾ ਪ੍ਰਦੂਸ਼ਿਤ        |
| `poor`          | 201 – 300 | Poor                   | ख़राब                    | ਮਾੜਾ                    |
| `very_poor`     | 301 – 400 | Very Poor              | बहुत ख़राब               | ਬਹੁਤ ਮਾੜਾ               |
| `severe`        | 401 – 500 | Severe                 | गंभीर                   | ਗੰਭੀਰ                   |

### 2.3  `grap_stage` (VERIFY against current GRAP order)

| Code      | Trigger AQI (VERIFY) | English                    | Hindi (VERIFY)                   | Punjabi (VERIFY)                  |
|-----------|----------------------|----------------------------|----------------------------------|-----------------------------------|
| `none`    | 0 – 200              | No GRAP action             | कोई GRAP कार्रवाई नहीं            | ਕੋਈ GRAP ਕਾਰਵਾਈ ਨਹੀਂ              |
| `stage_1` | 201 – 300            | Stage I — Poor             | चरण I — ख़राब                     | ਪੜਾਅ I — ਮਾੜਾ                     |
| `stage_2` | 301 – 400            | Stage II — Very Poor       | चरण II — बहुत ख़राब               | ਪੜਾਅ II — ਬਹੁਤ ਮਾੜਾ               |
| `stage_3` | 401 – 450 (VERIFY)   | Stage III — Severe         | चरण III — गंभीर                   | ਪੜਾਅ III — ਗੰਭੀਰ                  |
| `stage_4` | > 450 (VERIFY)       | Stage IV — Severe+         | चरण IV — अति गंभीर                | ਪੜਾਅ IV — ਬਹੁਤ ਗੰਭੀਰ              |

---

## 3  Field Conventions (P3 Endpoints)

| Field             | Rule                                                                 |
|-------------------|----------------------------------------------------------------------|
| `lat`, `lon`      | Latitude / Longitude. Never `lng`.                                   |
| Timestamps        | ISO 8601 with offset `+05:30` (e.g. `2026-10-08T18:30:00+05:30`).   |
| `direction_deg`   | Wind blows **FROM** this direction, degrees clockwise from north.    |
| `speed_kmh`       | Wind speed in km/h.                                                  |
| `temperature_c`   | Temperature in °C.                                                   |
| `humidity_pct`    | Relative humidity as a percentage (0–100).                           |
| `heat_index_c`    | Heat index in °C (NWS / Rothfusz formula).                          |
| Concentrations    | `ug/m3` for all pollutants except CO which uses `mg/m3`.             |
| `station_count`   | Integer — number of monitoring stations averaged.                    |
| `stale`           | Boolean — `true` if the latest reading is older than a threshold.    |

The `weather` block in AQI responses carries `temperature_c`, `humidity_pct`, and
`heat_index_c` — needed by P2's go/no-go dashboard.

---

## 4  Suggested Enums for P4 (complaint & case modules)

> These are starting suggestions. P4 owns the final decision.

### 4.1  `complaint_category` (suggested)

| Code              | English                |
|-------------------|------------------------|
| `stubble_burning`  | Stubble Burning        |
| `industrial`       | Industrial Emission    |
| `vehicle`          | Vehicle Pollution      |
| `construction`     | Construction Dust      |
| `waste_burning`    | Waste Burning          |
| `other`            | Other                  |

### 4.2  `case_status` (suggested)

| Code              | English                |
|-------------------|------------------------|
| `open`             | Open                   |
| `under_review`     | Under Review           |
| `action_taken`     | Action Taken           |
| `resolved`         | Resolved               |
| `dismissed`        | Dismissed              |

---

## 5  Display Labels — Architecture Note

Display labels for all enums live in **one** UI constants file.

- Suggested path: `src/lib/labels.ts` (owned by P2).
- The API never returns display strings — only the codes from the tables above.
- This keeps the API language-neutral and lets the UI switch languages without
  any backend change.
