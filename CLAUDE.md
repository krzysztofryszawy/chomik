# chomik

Chomik implements "Message from the past": reminders with context for a team,
created with an agent and checked deterministically in CI.

- Convention and current state: `docs/message-from-the-past.md`
- Decisions and their reasons: `docs/decisions.md`. Add an entry for every new decision.
- Security checklist, checked before every release: `docs/security-checklist.md`
- Development plans: `docs/roadmap.md`
- `main` stays clean because this history becomes public. Prototypes and work in
  progress go on feature branches, which are deleted afterwards. Changes reach
  `main` through squash merge, one meaningful commit per change.
- By default, merge a finished branch locally with `git merge --squash` and push
  `main`. Open a pull request only when the owner wants to review a larger change.
- Branch names: `type/short-description`, for example `feat/init-command`.
  Squash commit and pull request titles follow Conventional Commits (`feat: …`, `fix: …`, `docs: …`,
  `test: …`, `chore: …`) with the same type as the branch. The squash merge uses
  that title, so `main` reads as a changelog.
- Releases: bump `version` in `package.json` (and in the first comment of the copied
  check script and `chomik-workflow.yml`; a test checks), date its entry in
  `template/.claude/skills/chomik/CHANGELOG.md`, push a tag `v<version>`. The publish
  workflow runs `npm stage publish`; the owner approves the version on npmjs.com
  with 2FA. Nothing is published from a local machine. Right after a release, add its
  skill file hashes to `bin/released-files.json` (a test checks every `v*` tag)
  and bump `version` to the next one, with a new `unreleased` changelog entry, so
  new work is never mistaken for the released version. The changelog is for
  users: what changed in behavior, not a list of commits.
- The earlier history and the old npm learning demo live in the private repository
  `krzysztofryszawy/chomik-prototype`.
- Run tests with `npm test` (built-in `node:test`, no dependencies).
- Every CLI command and option has help (`--help` and `-h`) and a test. CLI
  behavior follows https://clig.dev: `--version`, exit code 0 only on success,
  errors on stderr, prompts only in a terminal with a flag instead. One way to do
  each thing: `npx chomik` both installs and updates; there is no second command
  for the same job. Running it without arguments is safe because it shows the
  plan and asks before writing. Help lives in one place, `npx chomik --help`,
  plus the README; other chomik files point there instead of repeating it.
- Before a design decision, search current sources for existing tools that already
  do it, and report what was found and what was not checked.
- No hooks or automatic actions in chomik's design; the user confirms every step.
