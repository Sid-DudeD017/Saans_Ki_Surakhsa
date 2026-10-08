# Example Sub-Index Arithmetic

## CPCB Sub-Index Interpolation Formula

```
I_p = ((I_HI - I_LO) / (BP_HI - BP_LO)) × (C_p - BP_LO) + I_LO
```

Where:
- `I_p` = sub-index for pollutant p (rounded to nearest integer)
- `C_p` = measured concentration
- `BP_LO`, `BP_HI` = breakpoint concentrations bounding C_p
- `I_LO`, `I_HI` = AQI values corresponding to those breakpoints

## Breakpoint Tables Used

### PM2.5 (24-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |   0   |  30   |
| Satisfactory | 51 | 100 |  31   |  60   |
| Moderate  | 101  | 200  |  61   |  90   |
| Poor      | 201  | 300  |  91   | 120   |
| Very Poor | 301  | 400  | 121   | 250   |
| Severe    | 401  | 500  | 251   | 380   | VERIFY

### PM10 (24-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |   0   |  50   |
| Satisfactory | 51 | 100 |  51   | 100   |
| Moderate  | 101  | 200  | 101   | 250   |
| Poor      | 201  | 300  | 251   | 350   |
| Very Poor | 301  | 400  | 351   | 430   |
| Severe    | 401  | 500  | 431   | 510   | VERIFY

### NO2 (24-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |   0   |  40   |
| Satisfactory | 51 | 100 |  41   |  80   |
| Moderate  | 101  | 200  |  81   | 180   |
| Poor      | 201  | 300  | 181   | 280   |
| Very Poor | 301  | 400  | 281   | 400   |
| Severe    | 401  | 500  | 401   | 500   | VERIFY

### O3 (8-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |   0   |  50   |
| Satisfactory | 51 | 100 |  51   | 100   |
| Moderate  | 101  | 200  | 101   | 168   |
| Poor      | 201  | 300  | 169   | 208   |
| Very Poor | 301  | 400  | 209   | 748   | VERIFY
| Severe    | 401  | 500  | 749   | 1000  | VERIFY

### CO (8-hr avg, mg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |  0.0  |  1.0  |
| Satisfactory | 51 | 100 |  1.1  |  2.0  |
| Moderate  | 101  | 200  |  2.1  | 10.0  |
| Poor      | 201  | 300  | 10.1  | 17.0  |
| Very Poor | 301  | 400  | 17.1  | 34.0  |
| Severe    | 401  | 500  | 34.1  | 46.0  | VERIFY

### SO2 (24-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |   0   |  40   |
| Satisfactory | 51 | 100 |  41   |  80   |
| Moderate  | 101  | 200  |  81   | 380   |
| Poor      | 201  | 300  | 381   | 800   |
| Very Poor | 301  | 400  | 801   | 1600  |
| Severe    | 401  | 500  | 1601  | 2100  | VERIFY

### NH3 (24-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |   0   | 200   |
| Satisfactory | 51 | 100 | 201   | 400   |
| Moderate  | 101  | 200  | 401   | 800   |
| Poor      | 201  | 300  | 801   | 1200  |
| Very Poor | 301  | 400  | 1201  | 1800  |
| Severe    | 401  | 500  | 1801  | 2400  | VERIFY

### Pb (24-hr avg, µg/m³)
| AQI Band  | I_LO | I_HI | BP_LO | BP_HI |
|-----------|------|------|-------|-------|
| Good      |   0  |  50  |  0.0  |  0.5  |
| Satisfactory | 51 | 100 | 0.51  | 1.0   |
| Moderate  | 101  | 200  |  1.1  |  2.0  |
| Poor      | 201  | 300  |  2.1  |  3.0  |
| Very Poor | 301  | 400  |  3.1  |  3.5  |
| Severe    | 401  | 500  | 3.51  |  4.0  | VERIFY

---

## Good Day Example (AQI = 45, dominant = pm25)

### PM2.5: C = 27.0 µg/m³ → sub-index 45
Band: Good (BP: 0–30, I: 0–50)
```
I = ((50 - 0) / (30 - 0)) × (27.0 - 0) + 0
  = (50/30) × 27.0
  = 1.6667 × 27.0
  = 45.0
```
**Sub-index = 45** ✓ (dominant, equals AQI)

### PM10: C = 40.0 µg/m³ → sub-index 40
Band: Good (BP: 0–50, I: 0–50)
```
I = ((50 - 0) / (50 - 0)) × (40.0 - 0) + 0
  = 1.0 × 40.0
  = 40.0
```
**Sub-index = 40** ✓

### O3: C = 30.0 µg/m³ → sub-index 30
Band: Good (BP: 0–50, I: 0–50)
```
I = ((50 - 0) / (50 - 0)) × (30.0 - 0) + 0
  = 1.0 × 30.0
  = 30.0
```
**Sub-index = 30** ✓

### GRAP: AQI 45 → None (Good range, no GRAP action)

### Weather: 28°C, 55% RH, heat index ≈ 28.5°C
Heat index at temps near 28°C with moderate humidity is negligibly above the dry-bulb temperature.

---

## Poor Day Example (AQI = 250, dominant = no2)

### NO2: C = 230.0 µg/m³ → sub-index 250
Band: Poor (BP: 181–280, I: 201–300)
```
I = ((300 - 201) / (280 - 181)) × (230.0 - 181) + 201
  = (99 / 99) × 49.0 + 201
  = 1.0 × 49.0 + 201
  = 250.0
```
**Sub-index = 250** ✓ (dominant, equals AQI)

### PM2.5: C = 96.6 µg/m³ → sub-index 220
Band: Poor (BP: 91–120, I: 201–300)
```
I = ((300 - 201) / (120 - 91)) × (96.6 - 91) + 201
  = (99 / 29) × 5.6 + 201
  = 3.41379 × 5.6 + 201
  = 19.12 + 201
  = 220.1
```
**Sub-index = 220** (rounded)

### CO: C = 1.6 mg/m³ → sub-index 78
Band: Satisfactory (BP: 1.1–2.0, I: 51–100)
```
I = ((100 - 51) / (2.0 - 1.1)) × (1.6 - 1.1) + 51
  = (49 / 0.9) × 0.5 + 51
  = 54.444 × 0.5 + 51
  = 27.22 + 51
  = 78.2
```
**Sub-index = 78** (rounded)

### GRAP: AQI 250 → Stage I (Poor = Stage I) VERIFY

### Weather: 33°C, 60% RH, heat index ≈ 38.7°C
At 33°C (91.4°F) with 60% humidity, heat index is significantly elevated. VERIFY (used Steadman approximation).

---

## Severe Day Example (AQI = 450, dominant = pm10)

### PM10: C = 470.0 µg/m³ → sub-index 450
Band: Severe (BP: 431–510, I: 401–500)
```
I = ((500 - 401) / (510 - 431)) × (470.0 - 431) + 401
  = (99 / 79) × 39.0 + 401
  = 1.25316 × 39.0 + 401
  = 48.87 + 401
  = 449.9
```
**Sub-index = 450** (rounded) ✓ (dominant, equals AQI)

### PM2.5: C = 275.8 µg/m³ → sub-index 420
Band: Severe (BP: 251–380, I: 401–500)
```
I = ((500 - 401) / (380 - 251)) × (275.8 - 251) + 401
  = (99 / 129) × 24.8 + 401
  = 0.76744 × 24.8 + 401
  = 19.03 + 401
  = 420.0
```
**Sub-index = 420** ✓

### O3: C = 134.2 µg/m³ → sub-index 150
Band: Moderate (BP: 101–168, I: 101–200)
```
I = ((200 - 101) / (168 - 101)) × (134.2 - 101) + 101
  = (99 / 67) × 33.2 + 101
  = 1.47761 × 33.2 + 101
  = 49.06 + 101
  = 150.1
```
**Sub-index = 150** (rounded)

### GRAP: AQI 450 → Stage III (Severe 401–450 = Stage III) VERIFY
- Stage I: AQI 201–300 (Poor)
- Stage II: AQI 301–400 (Very Poor)
- Stage III: AQI 401–450 (Severe)
- Stage IV: AQI >450 (Severe+)

### Weather: 38°C, 45% RH, heat index ≈ 42.1°C
At 38°C (100.4°F) with 45% humidity, heat index is elevated. VERIFY (used Steadman approximation).

---

## Rounding Rule
All sub-indices are rounded to the nearest integer (standard rounding: ≥ 0.5 rounds up). The overall AQI is the maximum sub-index across all pollutants.

## Overall AQI Rule
The overall AQI requires a minimum of 3 pollutants reported, at least one of which must be PM2.5 or PM10 (VERIFY: source is CPCB National AQI document). All three examples above satisfy this rule.
