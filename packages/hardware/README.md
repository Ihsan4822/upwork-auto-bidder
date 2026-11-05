# packages/hardware — NOT APPLICABLE (This MVP Has No Hardware)

## Status: RESERVED — Hardware Section 13 Rule Applies If This Is Ever Activated

This folder is intentionally empty in the MVP.

---

## Why This Folder Exists

Section 13 of the project brief establishes a universal hardware rule that applies
the moment any hardware integration is approved. This folder is the designated
location for all hardware adapters, universal drivers, and device configuration.

---

## If Hardware Is Ever Added (Read Before Writing Any Code)

Before writing a single line of hardware integration code, all 8 items below are required:

1. **Universal driver or standard protocol first.** A vendor SDK is a last resort only,
   and only behind an adapter in this folder. Never in core logic.

2. **Hardware behind an adapter or interface.** The brand or model must be swappable
   without touching `packages/core`, `apps/web`, or `apps/worker`.
   Example: a receipt printer swap should not change any business logic file.

3. **Standard output formats over proprietary ones.**
   Use ESC/POS, PDF, plain text. Receipt widths (58mm, 80mm) must be configurable
   in `packages/config`, never hardcoded here.

4. **Standard OS and browser APIs where they fit.**
   WebUSB, Web Serial, Web Bluetooth, OS print system — before any vendor utility.

5. **Offline and failure handling.** Device jobs must be queued.
   A device failure must never lose a record, bill, or order.

6. **A mock or simulated device for development and testing.**
   Work must never block on a physical device being present.

7. **Device type, model, and connection in config or settings.**
   Not hardcoded here. The RUNBOOK must list each device by name and model,
   its connection type, its standard protocol or universal driver, and its test method.

8. **Verify driver and protocol support before recommending or buying any device.**
   Never after purchase. Flag any device with no universal driver or standard
   protocol support before the purchase decision.

---

## Checklist for Hardware Approval Request

If you are proposing hardware for a future phase, provide all of the following:

- [ ] Device name and model
- [ ] Universal driver or standard protocol identified (not just vendor SDK)
- [ ] Adapter design described (what interface it implements)
- [ ] Mock device plan confirmed
- [ ] Driver/protocol support verified (how it was verified, not assumed)
- [ ] Config location for device type and connection
- [ ] RUNBOOK section drafted

**No hardware proposal is approved by a plan alone. Human approval is required.**
