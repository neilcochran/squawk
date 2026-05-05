# Contributing

Squawk is a one-maintainer personal project that's also published on npm. External contributions are welcome, but won't always align with project direction. For non-trivial changes, **open an issue first and wait for maintainer acknowledgment before starting work** - this filters out effort that won't merge. Trivial fixes (typos, broken links, obvious single-file bugs) can be PR'd directly without an issue.

## Setup

```sh
git clone https://github.com/neilcochran/squawk.git
cd squawk
npm install
npm run build
```

Node `>=22` and npm `11` are required. The repo is an npm-workspaces monorepo orchestrated by Turborepo.

## Orientation

Before opening a non-trivial PR, skim:

- [README](README.md) - what's published and how the repo is organized.
- [ARCHITECTURE.md](ARCHITECTURE.md) - the principles, processes, and architectural decisions that shape the codebase.
- [CONVENTIONS.md](CONVENTIONS.md) - the code-style, naming, TSDoc, test, and changeset conventions that PR review enforces.
- For atlas work, also [`apps/atlas/README.md`](apps/atlas/README.md) - the user-facing surface and app-specific stack.

## Branch names

Short, kebab-case, intent-describing branch names: `fetch-weather`, `route-distance-ete`, `airport-nearest-runway`. Not random IDs.

## Pull requests

- Open against `main`, with the PR body referencing the accepted issue (`Closes #N`). Trivial fixes are exempt.
- Include a [changeset](.changeset/) for any user-facing change to a published `@squawk/*` package. The changeset format is documented in [CONVENTIONS.md](CONVENTIONS.md#changeset-format).
- CI must pass: lint, knip, format, build, tests + per-file and aggregate coverage, pack-shape checks, and README-data-date checks. Details in [ARCHITECTURE.md](ARCHITECTURE.md#quality-gates).
- Reviews go through `@neilcochran` (I'm the only code owner today, see [CODEOWNERS](.github/CODEOWNERS)).

## Reporting bugs

Before filing, check the [project board](https://github.com/users/neilcochran/projects/2) to see what's already tracked. Use the [Bug report](.github/ISSUE_TEMPLATE/bug.yml) template. Include reproduction steps, the package and version, and the Node version.

## Suggesting features

Before filing, check the [project board](https://github.com/users/neilcochran/projects/2) to see what's already tracked. Use the [Enhancement](.github/ISSUE_TEMPLATE/enhancement.yml) template. Motivation and use case context go a long way.

## Questions and discussions

For questions about how to use a `@squawk/*` package, ask in the [Q&A category of Discussions](https://github.com/neilcochran/squawk/discussions/categories/q-a). The Issues tracker is reserved for bug reports and concrete feature requests; open-ended questions, usage help, and "is this the right approach" threads belong in Discussions.

## Security

Don't open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for the disclosure process.

## License

By submitting a contribution you agree to license it under the [MIT License](LICENSE.md), the same license the project ships under.
