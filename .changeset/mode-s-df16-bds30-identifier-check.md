---
'@squawk/mode-s': patch
---

### Fixed

- DF16 (long air-air surveillance reply) no longer decodes its MV field as an ACAS Resolution Advisory report unless the field's own register identifier actually says BDS 3,0 - MV is a general-purpose Comm-B register slot and can legitimately carry other register content, which was previously misread as a phantom (often "active") Resolution Advisory.
