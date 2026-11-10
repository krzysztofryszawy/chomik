# Installing chomik by hand

This is not the standard way to install chomik. Use `npx chomik@latest`, or the
last question in the README's FAQ if npm has `bin-links` switched off. Follow these steps
only if you cannot reach the npm registry or want to do everything yourself.

You need Node and a copy of this repository at a release tag, for example the
source archive of that tag from GitHub.

In the root of your project, copy:

1. `template/.claude/skills/chomik/` to `.claude/skills/chomik/`.
2. `template/.chomik/looking-for-messages-from-the-past.mjs` to `.chomik/`.
3. On GitHub: `template/.github/workflows/chomik.yml` to `.github/workflows/`.

Then type `/chomik` in your coding agent to leave a reminder.

To check reminders: `node .chomik/looking-for-messages-from-the-past.mjs`.

To update, copy the files of a newer tag over these. Nothing protects your edits to
them, as the installer does, and your reminders in `.chomik/` stay as they are.
