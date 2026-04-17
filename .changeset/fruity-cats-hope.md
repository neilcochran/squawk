---
'@squawk/weather': patch
---

- Fix `parseInternationalSigmet` throwing on ICAO-format bulletins with fused letter+digit sequence identifiers (e.g. `SIGMET A9`, `SIGMET B02`, `SIGMET D10`, `SIGMET AB9`). Common in South American and oceanic FIR feeds.
- Accept optional whitespace before the issuing-station dash in international SIGMET headers (`SBAZ -` as well as `SBAZ-`). The format detector, header stripper, and all header patterns now tolerate both forms.
- Accept multiple FIR codes preceding `SIGMET` in international headers (e.g. `KZMA TJZS SIGMET FOXTROT 3`). The FIR code closest to `SIGMET` is captured as the primary; earlier FIR codes are consumed by the body-level FIR parser.
- `parseInternationalCancellation` now handles cancellations that reference fused-identifier SIGMETs (e.g. `CNL SIGMET A6 ...`).
