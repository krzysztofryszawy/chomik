# Security Checklist

Chomik must always be classified as very safe. Check every item before each
release. Recorded on 2026-11-05.

## Reminder content

- [ ] The check script neutralizes reminder text before printing it to CI logs.
      GitHub Actions treats lines starting with `::` as workflow commands, so
      text from a reminder file must not be able to control the build.
- [ ] Prompts in reminders tell the agent to explain the situation first, change
      nothing without the user's consent, and never commit or push on its own.
      A malicious pull request could plant a reminder with harmful instructions;
      pull request review is the first line of defense.
- [ ] The skill never copies secrets from the session into a reminder: tokens,
      passwords, internal addresses, or customer data.
- [ ] The check script treats reminder files as data only. It never executes or
      evaluates their content.

## Package

- [ ] No install scripts (`preinstall`, `install`, `postinstall`, `prepare`).
- [ ] No runtime dependencies.
- [ ] No network access; the installer only copies files bundled in the package.
- [ ] Few published files, short and readable code, no obfuscation.
- [ ] Only the current line of versions is published on npm. Old versions
      0.0.1 and 0.0.2 (a demo with a network request and a file write) and
      0.1.0 to 0.1.9 were unpublished; the remaining 0.1.x go after the 0.2.0
      beta.

## Installer (`npx chomik`)

- [ ] Writes only inside the project folder and does not follow symbolic links
      that lead outside it.
- [ ] Touches only chomik's own files: `.claude/skills/chomik/`, the check
      script in `.chomik/` and, on GitHub, `.github/workflows/chomik.yml`;
      never the reminders, never another workflow, and never overwrites other
      existing files.
- [ ] Shows the plan, listing every file it creates or updates, and asks for
      confirmation before writing anything.
- [ ] `npx chomik check` only runs the project's own
      `.chomik/looking-for-messages-from-the-past.mjs`, the file CI runs, and
      refuses it when it is a symbolic link.

## Publishing

- [ ] The publish workflow pins every action to a full commit SHA, not a tag,
      and has minimal permissions.
- [ ] Publishing uses trusted publishing with provenance; the repository is
      public at that point.
- [ ] 2FA is enabled on the npm and GitHub accounts.
- [ ] After the first trusted publish, token publishing is disallowed in the
      package settings.
- [ ] The README recommends `npx chomik@latest`, the simplest command, which also
      bypasses an older copy cached by npx. A specific version is mentioned for
      people who want to pin it.

## Transparency

Chomik assumes the highest possible transparency: anyone, or their coding
agent, must be able to verify quickly that it is safe.

- [ ] No build step: the published files are the same plain JavaScript and
      Markdown files as in the repository, unminified, so anyone can compare them.
- [ ] One plain-language page lists every file chomik adds, every file it reads
      or changes, and states that it uses no network, no dependencies and no
      install scripts. It is written so a coding agent asked "is chomik safe?"
      finds the answer there and can check it against the code.
- [ ] The skill states its own limits in its text: which files it may write and
      that it never commits, pushes or touches files outside the project.
- [ ] Code comments appear only where something is deliberate or non-obvious,
      especially security choices.
- [ ] Tests run publicly in CI on every change.
- [ ] Every release has an entry in the skill's `CHANGELOG.md` describing what
      changed in behavior.
- [ ] Publicly verifiable signals, to confirm when set up: npm provenance
      (`npm install chomik && npm audit signatures` in an empty folder; it
      works only for installed dependencies, and `npm view` only shows that a
      record exists), OpenSSF Scorecard for repository practices,
      GitHub code scanning, secret scanning and private vulnerability reporting,
      and package scanners such as Socket. Check what each one actually reports
      before relying on it.

## Project files

- [ ] `LICENSE` file matching the MIT license declared in `package.json`.
- [ ] `SECURITY.md` explaining how to report a vulnerability privately.
