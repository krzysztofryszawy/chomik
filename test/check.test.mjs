import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const SCRIPT = resolve('template/.claude/skills/chomik/looking-for-messages-from-the-past.mjs');

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

const reminder = '# qs pin\n\nqs pinned at 6.13.0 because of a regression in 6.14.\n\n## Prompt\n\n```text\nAGENT-PROMPT-LINE\n```\n';

const noReminders = 'chomik: no reminders in .chomik/ yet.\nTo leave one, type /chomik in your coding agent. Help: npx chomik@latest --help\n';

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

test('a reminder without a Prompt section shows only the human part', () => {
  const { out } = check(project({ [`${isoDay(0)}-qs.md`]: '# qs pin\n\nNo prompt here.\n' }));
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
    assert.match(out, /invalid reminder file/, name);
  }
});

test('non-Markdown files in .chomik are ignored', () => {
  const { code, out } = check(project({ 'looking-for-messages-from-the-past.mjs': '', 'notes.txt': '' }), { ci: true });
  assert.equal(code, 0);
  assert.equal(out, noReminders);
});

test('symbolic links are not followed', () => {
  const root = project({});
  const outside = join(mkdtempSync(join(tmpdir(), 'chomik-outside-')), 'secret.md');
  writeFileSync(outside, 'OUTSIDE-CONTENT');
  symlinkSync(outside, join(root, '.chomik', `${isoDay(-1)}-link.md`));
  const { code, out } = check(root, { ci: true });
  assert.equal(code, 0);
  assert.doesNotMatch(out, /OUTSIDE-CONTENT/);
});

test('workflow commands in reminder text are switched off in GitHub Actions', () => {
  const evil = '::set-env name=X::y\n::add-mask::z\n';
  const { out } = check(project({ [`${isoDay(-1)}-evil.md`]: evil }), { ci: true });
  const lines = out.split('\n');
  const stop = lines.findIndex((l) => l.startsWith('::stop-commands::'));
  const token = lines[stop].slice('::stop-commands::'.length);
  const resume = lines.indexOf(`::${token}::`);
  const evilLine = lines.indexOf('::set-env name=X::y');
  assert.ok(token.length >= 32);
  assert.ok(stop < evilLine && evilLine < resume);
});
