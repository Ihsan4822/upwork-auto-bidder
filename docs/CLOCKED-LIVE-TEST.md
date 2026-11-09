# Clocked Live Test Report

Date: 2026-11-08T18:29:00Z
Base URL: https://clocked.rezolve.ai/clocked

## Status
LIVE EXECUTION PASSED: Clocked API Key authenticated successfully.
All pipeline endpoints executed and returned HTTP 200.

## Real Sample Job Test Results

### Sample Job: Ideal Amazon A+ (Fixed $800, United States, $45k spend, 4 proposals)

1. **Guard (Injection Detection):**
   - Verdict: `benign`
   - Injection Score: `0.0020` (Threshold: 0.5)
   - Severity: `none` (99.56% probability)

2. **Protect (PII Redaction):**
   - Entities Detected: `[]` (Clean, zero PII flags)

3. **Extract (Attribute Extraction):**
   - `budget_amount`: $800 (Confidence: 0.9999)
   - `client_spend`: $45,000 (Confidence: 0.9999)
   - `client_hire_rate`: 0.85 (85%) (Confidence: 0.9999)
   - `proposal_count`: 4 (Confidence: 0.9999)

4. **Decide (Decision Probabilities):**
   - Decision Choice: `APPLY_PLUS_BOOST`
   - Probabilities:
     - `APPLY_PLUS_BOOST`: 0.9331 (93.31%)
     - `APPLY`: 0.0572 (5.72%)
     - `SKIP`: 0.0097 (0.97%)
   - Overall Confidence: `0.8996` (Exceeds 0.75 threshold floor)
   - `budget_meets_floor`: `YES` (Probability: 0.9414, Confidence: 0.8827)

5. **Fill Scorecard:**
   - `rate_floor_pass`: `true` (Probability: 0.7705)
   - `match_score`: `excellent` (Probability: 0.9407)
   - `recommended_action`: `APPLY` / `APPLY_PLUS_BOOST`
   - Generated Reason: "The client is highly experienced with a high spend and hire rate, the budget is reasonable for the scope, and there is low competition with only 4 proposals"

6. **Verify (Grounding):**
   - Verdict: `partially_grounded` (Score: 0.5703)
   - `Client spend as stated`: 0.9914 supported
   - `Niche matches Amazon design`: 0.6001 supported

7. **Credits Used:**
   - Total credits consumed: 1 credit
