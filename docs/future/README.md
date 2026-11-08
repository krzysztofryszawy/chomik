# Future plans

Plans that go beyond chomik as it works today. **Nothing in this folder is built,
and nothing here changes chomik's current behavior or promises.** The folder is
not published to npm.

`chomik` for people is the core: reminders created with an agent, checked
deterministically in CI, with a person confirming every step. Its flow and its
promises (no dependencies, no network, no hooks, no automatic actions) stay as
they are unless a decision in [decisions.md](../decisions.md) says otherwise.

| Plan | Concerns | Status |
|---|---|---|
| [platform-independence.md](platform-independence.md) | People and agents alike: using chomik wherever they need it, across languages, CI systems, agents and distribution channels | Plan, starts after a stable chomik for people |
| [chomik-for-robots.md](chomik-for-robots.md) | A separate product for agents in multi-agent sessions (working name) | Direction to explore, nothing decided |

## How the two plans relate

They have different scopes and are worked through one at a time, so neither is
lost in the other. They meet in one place: the format specification and
conformance tests from stage 2 of the platform plan are also the natural
foundation for anything that reads or extends the reminder format. Platform
independence comes after a stable chomik for people, even one for Node only, and
then serves agents as much as people, with ready-made support in the environments
closest to them.

Rules that keep them apart:

- A plan may depend on `chomik`; `chomik` never depends on a plan.
- Work from `chomik-for-robots.md` never goes into the `chomik` package.
- A stage of the platform plan that touches `chomik` must keep today's flow
  working unchanged, and is proven by the existing tests.
- Each plan records what was checked, what was not, and against which version.
