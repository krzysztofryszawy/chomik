# chomik

Messages from the past: reminders with context for your team, checked in CI on
a chosen date.

You put off a fix, a temporary pin, or a follow-up. With your coding agent you
leave a reminder in the repository. On its date, the main-branch build turns red
and prints a ready prompt for any coding agent, plus a short explanation for
humans. Whoever takes it, even someone new to the project, knows what to do.

## Try it

In the root of a Node project:

```
npx chomik@0.1.1
```

Run the same command later to update. It shows the plan first, and it never
overwrites edits that are not committed to git.

Then open your coding agent in the project (Claude Code or GitHub Copilot) and
type `/chomik`.

## How it works

- A reminder is a Markdown file `.chomik/YYYY-MM-DD-name.md`: a part for humans
  and a prompt for an agent.
- `.chomik/check.mjs`, run as its own CI step, fails the build on the main
  branch from that date on. Locally and in pull requests it only prints the
  message.
- To handle a reminder, resolve the problem and delete the file, or rename it to
  a new date with a reason. No agent is required.

## Safety

No dependencies, no install scripts, no network, no build step. Details and
how to report a vulnerability: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
