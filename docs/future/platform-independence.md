# Platform independence for chomik

Long-term plan for `chomik` for people. Written on 2026-11-08 from the code of
chomik 0.1.7 and checked against 0.1.9. Stage sizes are relative (small, medium),
with no time estimates. Nothing here is built.

Every stage keeps today's flow working: the current GitHub workflow and the
current tests must pass unchanged.

## Summary

Independence from any one platform is realistic and can be reached in stages,
without rewriting everything. Chomik is already split into four layers: the
reminder format, the check script, the installer and the skill for the agent.
Only two are really tied down: the installer (it requires a Node project) and the
parts of the script and setup that deal with GitHub Actions. The project's
language (Python, Java) hardly matters, because a reminder is Markdown and the
check does not analyze the project's code.

Recommendation: first detach the script from GitHub and drop the `package.json`
requirement, then formalize the format and conformance tests, and only then add
distribution without Node and further CI systems. Do not port the script to Python
or Java.

## Four axes of independence

- The language of the project using chomik (Python, Java and others). Low cost.
- The CI provider (GitLab, Azure DevOps, Bitbucket, Cloud Build and others).
  Medium cost per provider.
- The coding agent (today Claude Code and GitHub Copilot, per the README). Scope
  to check.
- The distribution channel beyond npm (Docker image, binary, pip, Homebrew). Medium
  cost.

## Where chomik is tied down today

- The installer stops with a message that it needs `package.json` in the root of a
  Node project, and the package declares Node 22 or newer. This is the only real
  barrier for Python and Java projects.
- The check script has generic logic (about 215 lines, no dependencies). Its
  enforcing mode, the red build, depends on `GITHUB_ACTIONS`, `GITHUB_REF_TYPE` and
  `GITHUB_REF_NAME`, and its protection against command injection in the log relies
  on GitHub's `::stop-commands::`.
- Setup reads `.github/workflows/`, checks that `origin` points to github.com, and
  uses GitHub Actions mechanisms (`workflow_call`, `workflow_run`, a schedule on the
  default branch).
- The skill is in `.claude/skills/chomik/`.
- The reminder (`.chomik/YYYY-MM-DD-name.md` with the header `chomik: 1`) is tied to
  nothing.

## Stages

### Stage 1. Detach from GitHub and from Node in the installer (small)

Scope: in the script, add an enforcing flag, so the pipeline decides when the
build turns red, and `--format plain|json|github` instead of reading `GITHUB_*`
variables. In the installer, remove the `package.json` requirement so installing
works in any git repository.

Done when: the current GitHub workflow works with no change in behavior, the same
script passes the same tests in all three formats, and installing works in a
repository without `package.json`. JSON output is also useful to agents, because a
multi-agent session may have no CI at all.

### Stage 2. Format specification and conformance tests (small to medium)

Scope: describe the reminder format (file name, header, sections, print limits),
the exit codes and the behavior for invalid files. Build a set of reminders with
expected output that any implementation can be tested against.

Done when: the test set runs independently of the implementation. This is a
precondition for every further implementation and for conditions other than
dates.

### Stage 3. Distribution without Node (medium)

Scope: a Docker image as a universal CI adapter (it works in any CI system that
runs containers), and optionally a single binary in releases. Thin wrappers for pip
and uvx for Python environments, a pattern used by tools such as ruff and esbuild.
Maven and Gradle plugins only when there is demand.

To decide: the implementation language of the binary (stay with Node compiled to
an executable, or rewrite the small core in Go or Rust) and the channels (GitHub
Releases, an image registry, Homebrew, PyPI). The core is small, so a rewrite is
possible, but only together with the tests from stage 2.

### Stage 4. CI adapters (medium each)

Order: by where the author can test an adapter live. Candidates: GitLab CI, Azure
DevOps Pipelines, Bitbucket Pipelines, Google Cloud Build. Each adapter needs:

- a pipeline template with a daily schedule and minimal permissions;
- a way to enforce on a chosen branch only;
- escaping of the platform's own log commands;
- a pinned version of the tool or image;
- a setup variant in the skill, equivalent to the GitHub steps;
- a test on the real platform.

### Stage 5. Other agents and environments without CI (to explore)

Scope: check which instruction formats other coding agents read, and provide a
version of the skill for each one that makes sense. Provide a stable command-line
interface with JSON output for orchestrators of multi-agent sessions, which can run
the check without CI.

Starting point, checked on 2026-11-08: Agent Skills is an open standard
([agentskills.io](https://agentskills.io/specification)). VS Code's local Copilot
sessions read project skills from `.github/skills/`, `.claude/skills/` and
`.agents/skills/`, and OpenAI Codex reads `.agents/skills/`. Other agents were not
checked.

## Out of scope

- Separate implementations of the script in Python and Java. Maintaining several
  risks drift and brings no benefit, since the project's language does not affect
  how the check works.
- Maven and Gradle plugins without confirmed demand.

## Risks

- The security promises (no dependencies, no network, reading without executing
  content, log protection) have to be justified again for each platform. Azure
  Pipelines interprets `##vso[...]` commands written to the log, so protection
  based on `::stop-commands::` does not carry over as it is.
- The maintenance matrix grows with each CI provider and agent. The conformance
  tests from stage 2 limit this risk.
- Compatibility: new options must not change the meaning of the `chomik: 1` header.
  The parser already rejects unknown values instead of skipping them, so an old
  version will not silently ignore new reminders.
- Version drift between the package, the skill and the files in the project. The
  installer's file hashes are a good basis, but will need to cover more channels.

## Open decisions

- The implementation language of the binary distribution.
- The list and order of CI providers in stage 4.
- The first distribution channel beyond npm: Docker image, binary or pip.
- Whether the JSON output becomes a public, versioned contract for agents.

## What was checked

Read for the original analysis: the code of the chomik 0.1.7 package. Checked on
2026-11-08: the claims about the installer, script and setup against chomik 0.1.9,
the repository (it has no issues), Azure's log commands, and the skill folders read
by VS Code and Codex. Not checked: behavior of any CI system other than GitHub
Actions, and which instruction formats other agents read.
