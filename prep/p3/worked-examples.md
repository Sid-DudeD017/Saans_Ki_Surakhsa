# Indoor PM2.5 Hand Calculation: Windows Open with Cooking

## Inputs
- **Room volume ($V$)**: 40 m³ (Sharma bedroom example)
- **Air exchange rate ($a$)**: 6 h⁻¹ (Cross-ventilation, from Saans plan / Chen & Zhao 2011)
- **Penetration ($P$)**: 1.0 (Open windows, from Saans plan)
- **Deposition ($k$)**: 0.2 h⁻¹ (Settling rate, from Saans plan)
- **CADR**: 0 m³/h (Purifier off)
- **Outdoor PM2.5 ($C_{out}$)**: 280 µg/m³
- **Cooking emission rate ($S$)**: 300 mg/h (5 mg/min)
  - *Source*: Estimate based on real-world chulha emission factor of ~10.5 g PM2.5 per kg of wood (Atmos. Chem. Phys. 18, 15169, 2018), assuming 1 kg burnt/hour and ~3% of smoke stays indoors. 
  - *Note in JSON*: "Needs checking against kitchen measurements." -> **VERIFY**.

## Formula
$$ C_{in} = \frac{P \cdot a \cdot C_{out} + S/V}{a + k + CADR/V} $$

## Arithmetic Steps
1. **Convert emission rate to µg/h:**
   $S = 300 \text{ mg/h} \times 1000 = 300,000 \text{ µg/h}$

2. **Calculate outdoor contribution (numerator part 1):**
   $P \cdot a \cdot C_{out} = 1.0 \cdot 6 \cdot 280 = 1,680 \text{ µg/m³ \cdot h⁻¹}$

3. **Calculate indoor source contribution (numerator part 2):**
   $S / V = 300,000 / 40 = 7,500 \text{ µg/m³ \cdot h⁻¹}$

4. **Calculate total removal rate (denominator):**
   $a + k + CADR/V = 6 + 0.2 + 0 = 6.2 \text{ h⁻¹}$

5. **Solve for $C_{in}$:**
   $C_{in} = \frac{1,680 + 7,500}{6.2} = \frac{9,180}{6.2} \approx 1480.645 \text{ µg/m³}$

## Is this unusually high?
The concentration of ~1481 µg/m³ is driven by the very high emission rate of 300 mg/h (300,000 µg/h), which models **biomass (wood/dung) cooking** in the same room. While extremely high, this is a realistic scenario for a village home using an unvented *chulha*. However, it's unrealistic for a modern urban bedroom (like the Sharma example) or an LPG stove. 

If we use a realistic urban **LPG stove** scenario (14 mg/h = 14,000 µg/h):

## Indoor PM2.5 Hand Calculation: Windows Open with LPG Cooking

## Inputs
- **Room volume ($V$)**: 40 m³ (Sharma bedroom example)
- **Air exchange rate ($a$)**: 6 h⁻¹ (Cross-ventilation)
- **Penetration ($P$)**: 1.0 (Open windows)
- **Deposition ($k$)**: 0.2 h⁻¹ (Settling rate)
- **CADR**: 0 m³/h (Purifier off)
- **Outdoor PM2.5 ($C_{out}$)**: 280 µg/m³
- **Cooking emission rate ($S$)**: 14 mg/h
  - *Source*: WHO Indoor Air Quality Guidelines (2014) upper bound for gas burners.

## Formula
$$ C_{in} = \frac{P \cdot a \cdot C_{out} + S/V}{a + k + CADR/V} $$

## Arithmetic Steps
1. **Convert emission rate to µg/h:**
   $S = 14 \text{ mg/h} \times 1000 = 14,000 \text{ µg/h}$

2. **Calculate outdoor contribution (numerator part 1):**
   $P \cdot a \cdot C_{out} = 1.0 \cdot 6 \cdot 280 = 1,680 \text{ µg/m³ \cdot h⁻¹}$

3. **Calculate indoor source contribution (numerator part 2):**
   $S / V = 14,000 / 40 = 350 \text{ µg/m³ \cdot h⁻¹}$

4. **Calculate total removal rate (denominator):**
   $a + k + CADR/V = 6 + 0.2 + 0 = 6.2 \text{ h⁻¹}$

5. **Solve for $C_{in}$:**
   $C_{in} = \frac{1,680 + 350}{6.2} = \frac{2,030}{6.2} \approx 327.4 \text{ µg/m³}$

This is typical for urban cooking with windows open.

**Confirmation:** The expected values of ~1481 and ~327 in the tests come directly from these hand calculations, not from simply echoing the code's output.
