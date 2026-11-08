import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = resolve('template/.chomik/looking-for-messages-from-the-past.mjs');

function isoDay(offsetDays) {
  return new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

function project(files = {}) {
  const root = mkdtempSync(join(tmpdir(), 'chomik-'));
  if (files !== null) {
    mkdirSync(join(root, '.chomik'));
    for (const [name, content] of Object.entries(files)) writeFileSync(join(root, '.chomik', name), content);
  }
  return root;
}

function check(root, { ci = false, ref = 'main', refType = 'branch', args = ['--branch', 'main'] } = {}) {
  const env = { PATH: process.env.PATH };
  if (ci) Object.assign(env, { GITHUB_ACTIONS: 'true', GITHUB_REF_NAME: ref, GITHUB_REF_TYPE: refType });
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, env, encoding: 'utf8' });
  return { code: result.status, out: result.stdout + result.stderr };
}

const HEADER = '---\nchomik: 1\ncondition: date\n---\n\n';
const body = '# qs pin\n\nqs pinned at 6.13.0 because of a regression in 6.14.\n\n## Prompt\n\n```text\nAGENT-PROMPT-LINE\n```\n';
const reminder = HEADER + body;

const noReminders = 'chomik: no reminders in .chomik/ yet.\nTo leave one, type /chomik in your coding agent. More: .claude/skills/chomik/README.md\n';

test('no .chomik folder: passes and says there are no reminders', () => {
  const { code, out } = check(project(null), { ci: true });
  assert.equal(code, 0);
  assert.equal(out, noReminders);
});

test('one reminder in the future: passes and says when it is due', () => {
  const { code, out } = check(project({ [`${isoDay(30)}-qs.md`]: reminder }), { ci: true });
  assert.equal(code, 0);
  assert.equal(out, `chomik found no messages from the past for today.\n1 reminder is waiting; it is due on ${isoDay(30)}.\n`);
});

test('several reminders in the future: passes and names the next date', () => {
  const { code, out } = check(project({ [`${isoDay(40)}-b.md`]: reminder, [`${isoDay(10)}-a.md`]: reminder }));
  assert.equal(code, 0);
  assert.equal(out, `chomik found no messages from the past for today.\n2 reminders are waiting; the next one is due on ${isoDay(10)}.\n`);
});

test('due today in CI on the configured branch: fails with exit code 1', () => {
  const { code, out } = check(project({ [`${isoDay(0)}-qs.md`]: reminder }), { ci: true });
  assert.equal(code, 1);
  assert.match(out, /chomik sent a message from the past/);
  assert.match(out, /qs pinned at 6\.13\.0/);
});

test('the prompt comes first, then the human part, each between clear markers', () => {
  const { out } = check(project({ [`${isoDay(0)}-qs.md`]: reminder }));
  const lines = out.split('\n');
  assert.match(lines[0], /^chomik sent a message from the past: \.chomik\/.*-qs\.md$/);
  assert.match(lines[1], /Paste the prompt below/);
  const prompt = lines.indexOf('===== PROMPT =====');
  const promptEnd = lines.indexOf('===== END OF PROMPT =====');
  const human = lines.indexOf('===== FOR HUMANS =====');
  const humanEnd = lines.indexOf('===== END =====');
  assert.deepEqual(lines.slice(prompt + 1, promptEnd), ['AGENT-PROMPT-LINE']);
  assert.ok(promptEnd < human && human < humanEnd);
  assert.ok(lines.slice(human, humanEnd).includes('qs pinned at 6.13.0 because of a regression in 6.14.'));
});

test('a reminder from a newer format fails in CI and asks to update, even before its date', () => {
  const newer = `---\nchomik: 2\ncondition: date\n---\n\n${body}`;
  const { code, out } = check(project({ [`${isoDay(30)}-qs.md`]: newer }), { ci: true });
  assert.equal(code, 2);
  assert.match(out, /::error title=chomik::chomik found a reminder it cannot read/);
  assert.match(out, /asks for a newer chomik, or has a mistake\.\nThis chomik reads "chomik: 1" and "condition: date"\. To update chomik: npx chomik@latest\n {2}\.chomik\/.*-qs\.md/);
});

test('an unknown condition is reported locally but passes', () => {
  const unknown = `---\nchomik: 1\ncondition: dependency\n---\n\n${body}`;
  const { code, out } = check(project({ [`${isoDay(30)}-qs.md`]: unknown }));
  assert.equal(code, 0);
  assert.match(out, /asks for a newer chomik/);
  assert.match(out, /Not failing outside CI\./);
});

test('a reminder without a complete header is reported, not read', () => {
  for (const text of [body, `---\nchomik: 1\ncondition: date\n\n${body}`]) {
    const { code, out } = check(project({ [`${isoDay(0)}-qs.md`]: text }), { ci: true });
    assert.equal(code, 2);
    assert.match(out, /-qs\.md: it does not start with the header \(chomik: 1, condition: date\)/);
    assert.doesNotMatch(out, /qs pinned at 6\.13\.0/);
  }
});

test('due, invalid and newer reminders together are all reported, exit code 2', () => {
  const newer = `---\nchomik: 2\n---\n\n${body}`;
  const { code, out } = check(project({ [`${isoDay(0)}-due.md`]: reminder, 'notes.md': '', [`${isoDay(5)}-newer.md`]: newer }), { ci: true });
  assert.equal(code, 2);
  assert.match(out, /chomik sent a message from the past: \.chomik\/.*-due\.md/);
  assert.match(out, /not valid reminders:[\s\S]*\.chomik\/notes\.md: expected a name like/);
  assert.match(out, /asks for a newer chomik[\s\S]*-newer\.md/);
});

test('a code block inside the prompt does not cut the prompt short', () => {
  const text = HEADER + '# x\n\n## Prompt\n\n```text\nline one\n```bash\nls\n```\nnever push to main\n```\n';
  const lines = check(project({ [`${isoDay(0)}-x.md`]: text })).out.split('\n');
  const prompt = lines.slice(lines.indexOf('===== PROMPT =====') + 1, lines.indexOf('===== END OF PROMPT ====='));
  assert.deepEqual(prompt, ['line one', '```bash', 'ls', '```', 'never push to main']);
});

test('a heading that only starts with "Prompt" stays in the part for humans', () => {
  const text = HEADER + '# x\n\n## Prompt engineering notes\nkeep me\n\n## Resolved when\n- done\n\n## Prompt\n\n```text\nP\n```\n';
  const { out } = check(project({ [`${isoDay(0)}-x.md`]: text }));
  assert.match(out, /===== FOR HUMANS =====[\s\S]*keep me[\s\S]*## Resolved when\n- done\n===== END =====/);
});

test('a byte order mark before the header is ignored', () => {
  const text = `\uFEFF${HEADER}${body}`;
  const { out } = check(project({ [`${isoDay(0)}-qs.md`]: text }));
  assert.doesNotMatch(out, /chomik: 1/);
  assert.match(out, /===== FOR HUMANS =====\n# qs pin/);
});

test('a prompt that is cut says where the rest is', () => {
  const long = Array.from({ length: 205 }, (_, i) => `L${i}`).join('\n');
  const { out } = check(project({ [`${isoDay(0)}-long.md`]: `${HEADER}# x\n\n## Prompt\n\n\`\`\`text\n${long}\n\`\`\`\n` }));
  assert.match(out, /L199\n\.\.\. \(cut after 200 lines; the rest is in \.chomik\/.*-long\.md\)\n===== END OF PROMPT =====/);
});

test('the YAML header is not printed', () => {
  const withHeader = reminder;
  const { out } = check(project({ [`${isoDay(0)}-qs.md`]: withHeader }));
  assert.doesNotMatch(out, /chomik: 1|condition: date/);
  const lines = out.split('\n');
  assert.equal(lines[lines.indexOf('===== FOR HUMANS =====') + 1], '# qs pin');
  assert.deepEqual(lines.slice(lines.indexOf('===== PROMPT =====') + 1, lines.indexOf('===== END OF PROMPT =====')), ['AGENT-PROMPT-LINE']);
});

test('a reminder without a Prompt section shows only the human part', () => {
  const { out } = check(project({ [`${isoDay(0)}-qs.md`]: `${HEADER}# qs pin\n\nNo prompt here.\n` }));
  assert.match(out, /No prompt here/);
  assert.doesNotMatch(out, /===== PROMPT =====|Paste the prompt/);
  assert.match(out, /===== FOR HUMANS =====/);
});

test('overdue locally: prints the message but passes', () => {
  const { code, out } = check(project({ [`${isoDay(-3)}-qs.md`]: reminder }));
  assert.equal(code, 0);
  assert.match(out, /chomik sent a message from the past/);
  assert.match(out, /Not failing/);
});

test('overdue in a pull request: prints the message but passes', () => {
  const { code, out } = check(project({ [`${isoDay(-3)}-qs.md`]: reminder }), { ci: true, ref: '42/merge' });
  assert.equal(code, 0);
  assert.match(out, /chomik sent a message from the past/);
});

test('overdue in CI without --branch: passes', () => {
  const { code } = check(project({ [`${isoDay(-3)}-qs.md`]: reminder }), { ci: true, args: [] });
  assert.equal(code, 0);
});

test('a tag with the branch name does not fail the build', () => {
  const { code } = check(project({ [`${isoDay(-3)}-qs.md`]: reminder }), { ci: true, refType: 'tag' });
  assert.equal(code, 0);
});

test('invalid file name or impossible date in CI on the branch: exit code 2', () => {
  for (const name of ['qs.md', '2026-02-30-qs.md', '2026-1-05-qs.md', '2026-11-05-Bad Name.md']) {
    const { code, out } = check(project({ [name]: 'text' }), { ci: true });
    assert.equal(code, 2, name);
    assert.match(out, /not valid reminders:/, name);
  }
});

test('every other file or folder in .chomik is reported with its reason, never skipped', () => {
  const root = project({
    'looking-for-messages-from-the-past.mjs': '',
    'notes.txt': '',
    [`${isoDay(0)}-up.MD`]: 'x',
    [`${isoDay(0)}-old.md.bak`]: 'x',
    [`${isoDay(0)}-empty.md`]: '  \n',
    '2026-02-30-qs.md': 'x',
  });
  mkdirSync(join(root, '.chomik', 'archive'));
  const { code, out } = check(root, { ci: true });
  assert.equal(code, 2);
  assert.match(out, /^::error title=chomik::chomik found a file in \.chomik that is not a valid reminder$/m);
  assert.match(out, /\.chomik\/2026-02-30-qs\.md: that date does not exist/);
  assert.match(out, /-empty\.md: the file is empty/);
  assert.match(out, /-old\.md\.bak: expected a name like/);
  assert.match(out, /-up\.MD: expected a name like/);
  assert.match(out, /\.chomik\/archive: a folder; chomik reads only files directly in \.chomik\//);
  assert.match(out, /\.chomik\/notes\.txt: expected a name like/);
  assert.doesNotMatch(out, /looking-for-messages-from-the-past\.mjs:/);
});

test('output never starts with a blank line', () => {
  const { out } = check(project({ 'bad.md': 'x' }));
  assert.match(out, /^chomik found files in \.chomik\/ that are not valid reminders:/);
});

test('symbolic links are not followed', () => {
  const root = project({});
  const outside = join(mkdtempSync(join(tmpdir(), 'chomik-outside-')), 'secret.md');
  writeFileSync(outside, 'OUTSIDE-CONTENT');
  symlinkSync(outside, join(root, '.chomik', `${isoDay(-1)}-link.md`));
  const { code, out } = check(root, { ci: true });
  assert.equal(code, 2);
  assert.doesNotMatch(out, /OUTSIDE-CONTENT/);
  assert.match(out, /-link\.md: a symbolic link, which chomik does not follow/);
});

test('workflow commands in reminder text are switched off in GitHub Actions', () => {
  const evil = `${HEADER}::set-env name=X::y\n::add-mask::z\n`;
  const { out } = check(project({ [`${isoDay(-1)}-evil.md`]: evil }), { ci: true });
  const lines = out.split('\n');
  const stop = lines.findIndex((l) => l.startsWith('::stop-commands::'));
  const token = lines[stop].slice('::stop-commands::'.length);
  const resume = lines.indexOf(`::${token}::`);
  const evilLine = lines.indexOf('::set-env name=X::y');
  assert.ok(token.length >= 32);
  assert.ok(stop < evilLine && evilLine < resume);
});
