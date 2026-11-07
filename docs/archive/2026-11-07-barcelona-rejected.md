# Archived decision: Barcelona rejected, London kept (2026-11-07)

Archived for reference only. Not needed for day-to-day work on chomik.

## The two variants

- **London** (current, chomik 0.1.4): the agent copies the check script and
  `.github/workflows/chomik.yml` into the user's repository; the build calls it
  with two lines.
- **Barcelona** (proposed in a separate analysis): the check code lives in the
  chomik repository as a composite GitHub Action; the user's build calls it in a
  separate job, pinned to a commit SHA; `npx chomik` installs only the skill.

## Why London was kept

1. **Local reproducibility.** With the script in the repository, anyone can run
   the check locally with one command. Barcelona would need something like
   `npx chomik check`, which means network and npm.
2. **Trust at review time.** In London the pull request shows all code that will
   run in CI. In Barcelona the reviewer sees only a SHA and must inspect another
   repository, a harder sell for a young project with one maintainer.
3. **Updates.** Barcelona relies on Dependabot SHA bumps, which many teams merge
   automatically, letting new chomik code into CI unread. This contradicts
   "updates are proposed, never automatic".
4. **Ease of use over ease of maintenance.** Barcelona's advantages (smaller diff,
   easier updates) mostly help the maintainer, not the user.

## Directions rejected in the analysis (agreed)

- Entry in `package.json` (for example in the build script): edits a project
  file, runs chomik where deploy credentials may exist, affects local builds.
- A separate workflow without hooking into the build: loses the red build.
- A GitHub App (own check run or deploy protection rule): a new party with
  permissions on the repository.
- Organization-level required workflows: need an organization plan and rights;
  they do not fit a single developer.
- A reusable workflow from the chomik repository instead of an Action:
  equivalent isolation; the Action was preferred there because the whole job
  frame is visible in the user's YAML.

## Security principles from the analysis

Pin to a full SHA, never a tag or branch. A separate job with
`permissions: contents: read` and no secrets (no `secrets: inherit`). Fixed job
content shipped by the skill, never improvised by the agent. Every change as a
git diff. Read Dependabot PRs instead of approving them by habit. Keep the check
script small, dependency-free and offline. Most of these already apply to
London.

## Checked facts

- **Immutable releases** exist on GitHub (generally available since October
  2025): the tag is locked to its commit and cannot be moved or deleted while
  the release exists, assets are locked, and a signed release attestation is
  created (`gh release verify`). They apply to GitHub Releases; chomik publishes
  only tags and npm packages today. Optional later addition: it would make `v*`
  tags unmovable, at the cost of write permission in the publish workflow.
  Sources: https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases,
  https://github.blog/changelog/2025-10-28-immutable-releases-are-now-generally-available/
- **Marketplace verified creator badge**: GitHub has verified the creator as a
  partner organization. It confirms identity, not code. Not available to a
  single developer, so irrelevant for chomik.
  Sources: https://docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace,
  https://docs.github.com/en/actions/reference/security/secure-use
- The analysis verified chomik 0.1.4: all 9 package files match the repository
  at tag `v0.1.4`, the npm registry signature and tarball checksum are valid,
  and the provenance attestation points to `publish.yml`, tag `v0.1.4`, commit
  `fb43c97`. It could not run `npm audit signatures` (sigstore blocked there).

## Other tools found (from their project pages, not tested)

All work on comments in code, without context or an agent prompt:
`unicorn/expiring-todo-comments` (ESLint; date checks off by default),
`timebomb-cli` (Rust, language-independent, PR annotations), DebtBomb (date,
owner, reason, optional Jira ticket), Todo or Else (Go, deadlines in comments,
flags TODOs older than 90 days).
