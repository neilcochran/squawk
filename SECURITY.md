# Security Policy

## Supported versions

Only the latest published version of each `@squawk/*` package receives security updates. Older versions are not patched.

## Reporting a vulnerability

Please report security vulnerabilities privately via GitHub's [security advisory feature](https://github.com/neilcochran/squawk/security/advisories/new) rather than opening a public issue. This keeps the report and the coordination thread off the public tracker until a fix is published.

What to include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce, or a proof of concept if available.
- The affected package(s) and version(s).
- Any suggested mitigation, if you have one in mind.

Squawk is a one-maintainer project, so initial response time is measured in days rather than hours. There is no formal SLA.

## Disclosure

After a fix is published to npm, the security advisory is made public. Credit to the reporter is included in the advisory unless the reporter prefers anonymity.

## Out of scope

- **Vulnerabilities in transitive dependencies.** Dependabot tracks these automatically and opens PRs for known CVEs. If you find a CVE in a dep that Dependabot hasn't surfaced, a regular issue is fine.
- **CodeQL findings on this repository.** These are tracked internally via the GitHub Security tab and don't need external reporting.
