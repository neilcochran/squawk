---
'@squawk/weather': patch
'@squawk/notams': patch
'@squawk/mcp': patch
---

**@squawk/notams**

- Fix ReDoS in `parseNotam` Q-line extraction. A NOTAM containing many slashes after the Q-line could cause exponential regex backtracking (a 129-byte input previously hung the event loop for ~4s; now linear in input length).

**@squawk/weather**

- Fix polynomial-time slowdown in international SIGMET header stripping (used by `parseSigmet` and `parseSigmetBulletin`). Bulletins with many leading 4-letter tokens and no trailing dash on the SIGMET line previously took O(N²) time; now linear.
- When a SIGMET prefix contains multiple FIR codes that survive WMO/AWIPS header stripping, all of them are now preserved in the body for downstream FIR parsing instead of only the FIR closest to `SIGMET`.
