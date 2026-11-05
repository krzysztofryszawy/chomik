import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const BIN = resolve('bin/chomik.mjs');
const TEMPLATE = resolve('template/.claude/skills/chomik');
const SKILL_DIR = join('.claude', 'skills', 'chomik');

function project({ packageJson = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'chomik-init-'));
  if (packageJson) writeFileSync(join(root, 'package.json'), '{"name":"app"}\n');
  return root;
}

function run(root, args) {
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: 'utf8', input: '' });
  return { code: result.status, out: result.stdout + result.stderr };
}

test('init --yes copies exactly the two skill files', () => {
  const root = project();
  const { code, out } = run(root, ['init', '--yes']);
  assert.equal(code, 0);
  assert.match(out, /create \.claude\/skills\/chomik\/SKILL\.md/);
  assert.match(out, /type \/chomik/);
  assert.deepEqual(readdirSync(join(root, SKILL_DIR)).sort(), ['SKILL.md', 'check.mjs']);
  for (const file of ['SKILL.md', 'check.mjs']) {
    assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(readFileSync(join(TEMPLATE, file))), file);
  }
  assert.deepEqual(readdirSync(root).sort(), ['.claude', 'package.json']);
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), '{"name":"app"}\n');
});

test('running init again reports that everything is up to date', () => {
  const root = project();
  run(root, ['init', '--yes']);
  const { code, out } = run(root, ['init', '--yes']);
  assert.equal(code, 0);
  assert.match(out, /already installed/);
});

test('a changed skill file is shown as an update and replaced', () => {
  const root = project();
  run(root, ['init', '--yes']);
  writeFileSync(join(root, SKILL_DIR, 'SKILL.md'), 'old');
  const { out } = run(root, ['init', '--yes']);
  assert.match(out, /update \.claude\/skills\/chomik\/SKILL\.md/);
  assert.doesNotMatch(out, /check\.mjs/);
  assert.ok(readFileSync(join(root, SKILL_DIR, 'SKILL.md')).equals(readFileSync(join(TEMPLATE, 'SKILL.md'))));
});

test('without a terminal and without --yes nothing is written', () => {
  const root = project();
  const { code, out } = run(root, ['init']);
  assert.equal(code, 1);
  assert.match(out, /add --yes/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('refuses to run outside a Node project', () => {
  const root = project({ packageJson: false });
  const { code, out } = run(root, ['init', '--yes']);
  assert.equal(code, 1);
  assert.match(out, /no package\.json/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('refuses to write through a symbolic link', () => {
  const root = project();
  const outside = mkdtempSync(join(tmpdir(), 'chomik-outside-'));
  symlinkSync(outside, join(root, '.claude'));
  const { code, out } = run(root, ['init', '--yes']);
  assert.equal(code, 1);
  assert.match(out, /symbolic link/);
  assert.deepEqual(readdirSync(outside), []);
});

test('other files under .claude are left untouched', () => {
  const root = project();
  mkdirSync(join(root, '.claude', 'skills', 'other'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'other', 'SKILL.md'), 'keep me');
  run(root, ['init', '--yes']);
  assert.equal(readFileSync(join(root, '.claude', 'skills', 'other', 'SKILL.md'), 'utf8'), 'keep me');
});

test('without a command it prints usage', () => {
  const { code, out } = run(project(), []);
  assert.equal(code, 0);
  assert.match(out, /Usage: npx chomik init/);
});
