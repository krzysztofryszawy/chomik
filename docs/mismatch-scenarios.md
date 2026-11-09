# Mismatch scenarios

Unusual states a project can be in, what chomik should do in each, and how it is
tested. Only the current version is considered: until the 0.2.0 beta nobody
but testers uses chomik, so there is nothing older to migrate. Rule of thumb from [decisions.md](decisions.md): anything unknown fails
loudly with a hint, and nothing is downgraded or overwritten silently.

Two kinds of tests:

- **Automated** (`npm test`): the installer and the check script are
  deterministic. Each scenario builds a temporary project in that state, for
  example with the skill files of an older release taken from its git tag.
- **Agent run** (by hand for now): the skill's behavior depends on the model. A
  script prepares a temporary repository in that state, then `/chomik` runs in a
  fresh agent session and the answer is compared with "Expected". Record the
  agent, model and date with the result.

Status: ✅ covered, ⚠️ partly covered, ❌ not covered yet.

## Installer: skill versions

| Scenario | Expected | Test |
|---|---|---|
| First install | Plan, confirm, six files | ✅ automated |
| Same version again | "already here and up to date" | ✅ automated |
| Update from the newest older release, unedited | `old -> new`, changelog prompt | ✅ automated |
| Update from every older release, not only the newest | Same as above for each `v*` tag | ✅ automated |
| Edited skill files, committed / not committed / no git | Replace with a note / refuse / refuse | ✅ automated |
| Skill files from different versions mixed | Treated as edited, never as one version | ✅ automated |
| A skill file deleted by hand | Recreated, nothing else touched | ✅ automated |
| Older chomik run over a newer skill (stale npx cache) | Refuse to downgrade, suggest `npx chomik@latest`; `--force` downgrades on purpose | ✅ automated |
| npm with `bin-links=false` and `ignore-scripts=true` | `npx chomik` fails with "command not found"; the FAQ gives a path that keeps both settings | ⚠️ by hand |
| Run in a subfolder or a monorepo package | Stop and name the repository root | ✅ automated |
| New version released between a dry run and the install | The plan shown before the question is the current one | ⚠️ by hand |
| Check script edited by hand | Update refused unless the edit is committed or `--force` is used | ✅ automated |
| Node older than `engines` in `package.json` | Stop before anything else, name the Node needed | ✅ automated, with a faked version |

## Check: package, skill, script and workflow

| Scenario | Expected | Test |
|---|---|---|
| Skill, script and workflow match | No extra line | ✅ automated |
| No CI workflow, project on GitHub | One line: CI is not set up; type /chomik | ✅ automated |
| No CI workflow, project not on GitHub | One line: not on GitHub yet; /chomik once it is | ✅ automated |
| Check script older than the skill | "older than chomik X; run npx chomik@latest" | ✅ automated |
| CI workflow older than the skill | ".github/workflows/chomik.yml is still X; type /chomik" | ✅ automated |
| Check script newer than the skill (a teammate updated) | No hint, no downgrade | ✅ automated |
| Package newer than the skill | "X is out; this project has Y" | ✅ automated |
| Package older than the skill (stale npx cache) | No hint | ✅ automated, as an unknown skill |
| Skill edited, so its version is unknown | No hint | ✅ automated |

## Check script: reminders

| Scenario | Expected | Test |
|---|---|---|
| Reminder from a newer format | Fails in CI (exit 2), asks to update | ✅ automated |
| Unknown condition | Reported, passes locally | ✅ automated |
| No header, or a header without its closing `---` | Reported as invalid, not read | ✅ automated |
| Due, invalid and newer reminders together | All reported, exit 2 in CI | ✅ automated |
| Other files or folders in `.chomik/` (`.MD`, `.md.bak`, subfolder, symbolic link, empty file) | Each reported with its reason, exit 2 in CI | ✅ automated |
| Code block inside the prompt, heading starting with "Prompt", byte order mark | Nothing cut or misread | ✅ automated |
| Reminder renamed to a new date | The prompt shows the file's current path | ✅ automated |
| Check script missing, reminders still there | Says how many reminders are not checked | ✅ automated |

## Skill: agent runs

| Scenario | Expected | Test |
|---|---|---|
| No GitHub remote | Says the full flow needs GitHub; asks: GitHub first (done by the user) or local for now | ⚠️ by hand |
| GitHub, no workflows | Proposes a standalone `chomik.yml` | ⚠️ by hand |
| GitHub with a daily build | Adds the two-line job, nothing else in the build | ❌ |
| Local use, then moving to CI | Runs setup, keeps reminders | ❌ |
| CI workflow older than the skill | Proposes replacing it first, waits for a yes | ❌ |
| CI workflow newer than the skill | Does not propose replacing it | ❌ |
| Reminders but no CI workflow | Writes the reminder, then one sentence that it shows only with `npx chomik check` and that `/chomik` can set up CI | ❌ |
| Developer asks for something the skill does not cover (hooks, cron) | Answers from README, invents no setup | ⚠️ by hand |
| Developer asks to see how chomik works | Minimal tutorial, one command at a time for the developer to run; no inner details unless asked | ❌ |
| Setup only, nothing to remember yet | Ends after setup, no reminder suggested | ⚠️ by hand |

## Next steps

1. A script that prepares each agent-run scenario in a temporary repository, so
   a run takes one command plus `/chomik`.
