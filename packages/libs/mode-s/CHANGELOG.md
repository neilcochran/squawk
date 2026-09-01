# @squawk/mode-s

## 0.1.0

### Minor Changes

- 871a15d: **@squawk/mode-s** decodes raw Mode-S/ADS-B messages: downlink format and CRC extraction, CPR position, airborne velocity, aircraft identification, altitude (both the ADS-B position-message field and legacy Gillham-coded surveillance replies), squawk identity, emergency status, ACAS/TCAS Resolution Advisories, target state and status, aircraft operational status, and Enhanced Surveillance Comm-B registers (BDS 4,0/5,0/6,0). Transport-agnostic - operates on already-framed message bytes regardless of source.
