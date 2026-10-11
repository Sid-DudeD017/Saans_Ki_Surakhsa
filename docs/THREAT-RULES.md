# Threat Assessment Rules

The Threat Assessment engine calculates an automated severity level (`low`, `medium`, `high`, `critical`) based on structured inputs about an incident. It is a pure function that only recommends a threat level; it triggers **no automatic actions**.

## Inputs
- **Urgency**: Is there an immediate need for intervention? (boolean)
- **Violence**: Is violence occurring or threatened? (boolean)
- **Weapons**: Are weapons present? (boolean)
- **Vulnerable People**: Are children, elderly, or disabled individuals present? (boolean)
- **Immediacy**: How soon might the threat manifest? (past, imminent, ongoing)
- **Location**: Is the incident near a school, hospital, or crowded place? (boolean)
- **Evidence Quality**: Reliability of the report (none, low, medium, high)

## Scoring System
Each factor contributes to a total `score` (0-100), mapped to a `threat_level`:

- **Violence**: +40
- **Weapons**: +40
- **Vulnerable People**: +20
- **Location (Sensitive Area)**: +15
- **Urgency**: +10
- **Immediacy**: `ongoing` (+20), `imminent` (+10), `past` (+0)
- **Evidence Quality**: High quality may add +5.

## Threat Levels
- **critical**: Score >= 80. Imminent risk of severe harm.
- **high**: Score 50 - 79. High potential for harm or significant incident in a sensitive area.
- **medium**: Score 20 - 49. Potential disturbance but without immediate life threats.
- **low**: Score < 20. Routine complaint, no immediate risk.

## Missing Data & Defaults
Missing data safely defaults to `false` or `low` to avoid false panics, but the `urgency` flag alone sets a baseline of `medium`. If `urgency` is true but other fields are missing, the system never defaults to `low` for an emergency flag.

## Overrides
Officers or supervisors may override the automated recommendation. 
- Overrides require a mandatory human-readable reason.
- Overrides are recorded in the audit log.
- Citizens cannot override threat levels.

## Constraints
- **Automated Label**: Every response must be labeled with `automated_label: "automated recommendation only"`.
- **No Automatic Action**: No code path triggers arrest, force, surveillance, or punishment automatically based on the threat level.
