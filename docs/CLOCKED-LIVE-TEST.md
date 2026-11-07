# Clocked Live Test Report

Date: 7 Nov 2026
Base URL: https://clocked.rezolve.ai/clocked

## Status
CLOCKED_API_KEY was not found in .env. Live pipeline calls require a valid Rezolve API key.

## Expected Verification Matrix (Mock Verified via Unit Tests)
1. Sample Job 1 (Ideal Amazon A+): Action APPLY_PLUS_BOOST, Confidence 0.94, Credits 4
2. Sample Job 2 (Prompt Injection): Action SKIP (Human Review - Critical Injection), Confidence 0.88, Credits 2
3. Sample Job 3 (Low Confidence): Action SKIP (Human Review - Confidence < 0.75), Confidence 0.62, Credits 3
4. Sample Job 4 (Clocked Outage): Action SKIP (Human Review - Network/API Failure Fallback), Confidence 0.00, Credits 0
5. Sample Job 5 (Clean SKIP): Action SKIP, Confidence 0.96, Credits 3
