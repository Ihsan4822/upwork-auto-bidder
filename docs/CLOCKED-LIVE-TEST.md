# Clocked Live Test Report

Date: 7 Nov 2026
Base URL: https://clocked.rezolve.ai/clocked

## Status
BLOCKED: CLOCKED_API_KEY was not found in .env on this machine.
Live API calls could not be executed against https://clocked.rezolve.ai/clocked.
Do not mistake unit test mock assertions for live test execution results.

## Sample Jobs Specification (Reference Only)
1. Sample Job 1 (Ideal Amazon A+): Expected APPLY_PLUS_BOOST (Amazon design match, budget meets floor, verified client)
2. Sample Job 2 (Prompt Injection): Expected SKIP (Guard flags critical prompt injection, routed to human review)
3. Sample Job 3 (Low Confidence): Expected SKIP (Decide confidence below 0.75 floor, routed to human review)
4. Sample Job 4 (Clocked Outage): Expected SKIP (Clocked network or server outage fallback, routed to human review)
5. Sample Job 5 (Clean SKIP): Expected SKIP (WordPress checkout task, entirely outside Amazon design niche)
