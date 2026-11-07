# Security Policy

## Reporting a vulnerability

Please report vulnerabilities privately through GitHub:
**Security → Report a vulnerability** in
[krzysztofryszawy/chomik](https://github.com/krzysztofryszawy/chomik/security).
Do not open a public issue for a vulnerability.

## What chomik does on your machine

- `npx chomik` installs or updates the skill files in `.claude/skills/chomik/` in the
  current project, after showing the plan and asking for confirmation. It
  changes nothing else, refuses to write through symbolic links, and adds no
  dependencies. It never overwrites edits that are not committed to git (unless
  you pass `--force`); to check this it runs `git status` and `git ls-files`,
  read-only.
- `.chomik/looking-for-messages-from-the-past.mjs` only reads Markdown files in `.chomik/`, compares the dates
  in their names with today's date, and prints messages. It never executes
  their content and switches off GitHub workflow commands while printing it.
- The package has no install scripts, no dependencies, uses no network, and has
  no build step: the published files are the files in this repository.
- Releases are published from GitHub Actions with npm provenance, so you can
  verify which commit and workflow built a version with `npm audit signatures`.
