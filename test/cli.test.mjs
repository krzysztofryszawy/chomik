import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const BIN = resolve('bin/chomik.mjs');
const TEMPLATE = resolve('template/.claude/skills/chomik');
const SKILL_DIR = join('.claude', 'skills', 'chomik');
const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const RELEASED = JSON.parse(readFileSync('bin/released-files.json', 'utf8'));

function project({ packageJson = true, git = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'chomik-cli-'));
  if (packageJson) writeFileSync(join(root, 'package.json'), '{"name":"app"}\n');
  if (git) {
    gitIn(root, 'init', '-q');
    gitIn(root, 'add', '-A');
    gitIn(root, 'commit', '-qm', 'init');
  }
  return root;
}

function gitIn(root, ...args) {
  execFileSync('git', ['-c', 'user.email=test@example.invalid', '-c', 'user.name=test', ...args], { cwd: root });
}

function run(root, args) {
  const result = spawnSync(process.execPath, [BIN, ...args], { cwd: root, encoding: 'utf8', input: '' });
  return { code: result.status, out: result.stdout + result.stderr, stdout: result.stdout, stderr: result.stderr };
}

const skillFile = (root) => join(root, SKILL_DIR, 'SKILL.md');
const template = (file) => readFileSync(join(TEMPLATE, file));
const SCRIPT = 'looking-for-messages-from-the-past.mjs';
const FILES = ['SKILL.md', 'setup.md', 'README.md', 'CHANGELOG.md', SCRIPT, 'chomik-workflow.yml'];

test('npx chomik --yes installs exactly the skill files', () => {
  const root = project();
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Installing chomik ${VERSION.replaceAll('.', '\\.')} in this project`));
  assert.match(stdout, /create\s+\.claude\/skills\/chomik\/SKILL\.md/);
  assert.match(stdout, /\n\nchomik just moved in\.\nFirst time with chomik\? Paste this into a new session of your coding agent:\n {2}Read \.claude\/skills\/chomik\/README\.md and explain with its examples .*Do not change anything\.\nThen type \/chomik there to set it up\.\n$/);
  assert.doesNotMatch(stdout, /Feel free to share chomik/);
  assert.deepEqual(readdirSync(join(root, SKILL_DIR)).sort(), ['SKILL.md', 'setup.md', 'README.md', 'CHANGELOG.md', SCRIPT, 'chomik-workflow.yml'].sort());
  for (const file of ['SKILL.md', 'setup.md', 'README.md', 'CHANGELOG.md', SCRIPT, 'chomik-workflow.yml'].sort()) assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(template(file)));
  assert.deepEqual(readdirSync(root).sort(), ['.claude', 'package.json']);
});

test('running again reports that everything is up to date', () => {
  const root = project();
  run(root, ['--yes']);
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`chomik ${VERSION.replaceAll('.', '\\.')} is already here and up to date`));
});

test('an unedited older release is updated and shows the versions', () => {
  const tag = (() => {
    try {
      return execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' }).split('\n')[0];
    } catch {
      return '';
    }
  })();
  if (!tag) return;
  const oldFile = (file) => execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]);
  if (oldFile('SKILL.md').equals(template('SKILL.md'))) return;
  const root = project();
  mkdirSync(join(root, SKILL_DIR), { recursive: true });
  const oldFiles = Object.keys(RELEASED[tag.slice(1)]);
  for (const file of oldFiles) writeFileSync(join(root, SKILL_DIR, file), oldFile(file));
  const version = tag.slice(1).replaceAll('.', '\\.');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Updating chomik in this project: ${version} -> `));
  assert.match(stdout, new RegExp(`\\n\\nchomik learned some new tricks\\. Curious which\\? Paste this into a new session of your coding agent:\\n {2}Read \\.claude/skills/chomik/CHANGELOG\\.md and tell me briefly what changed since chomik ${version} and what it means .*Do not change anything\\.\\n$`));
  assert.match(stdout, /update\s+\.claude\/skills\/chomik\/SKILL\.md/);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('uncommitted edits block the whole update and nothing is written', () => {
  const root = project({ git: true });
  run(root, ['--yes']);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'chomik');
  writeFileSync(skillFile(root), 'my uncommitted edit');
  writeFileSync(join(root, SKILL_DIR, SCRIPT), 'old');
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /would be lost for good/);
  assert.equal(readFileSync(skillFile(root), 'utf8'), 'my uncommitted edit');
  assert.equal(readFileSync(join(root, SKILL_DIR, SCRIPT), 'utf8'), 'old');
});

test('edits in a project without git block the update', () => {
  const root = project();
  run(root, ['--yes']);
  writeFileSync(skillFile(root), 'my edit');
  const { code, stdout, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stdout, /edited here; this project has no git to keep them/);
  assert.match(stderr, /would be lost for good/);
  assert.match(stderr, /Copy them somewhere safe and run again, or add --force to overwrite\./);
  assert.doesNotMatch(stderr, /stash/);
  assert.equal(readFileSync(skillFile(root), 'utf8'), 'my edit');
});

test('committed edits are replaced with a note, since git keeps them', () => {
  const root = project({ git: true });
  run(root, ['--yes']);
  writeFileSync(skillFile(root), 'my committed edit');
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'customize');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, /replace\s+.*SKILL\.md \(edited here; your committed changes stay in git history\)/);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('--force overwrites edits that are not committed', () => {
  const root = project();
  run(root, ['--yes']);
  writeFileSync(skillFile(root), 'my edit');
  const { code } = run(root, ['--yes', '--force']);
  assert.equal(code, 0);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('--dry-run shows the plan and writes nothing', () => {
  const root = project();
  const { code, stdout } = run(root, ['--dry-run']);
  assert.equal(code, 0);
  assert.match(stdout, /create/);
  assert.match(stdout, /Then \/chomik in your coding agent sets chomik up with you/);
  assert.match(stdout, /This project is not on GitHub yet; chomik can work locally until it is\./);
  assert.match(stdout, /Dry run: nothing was changed\. To install, run the same command without --dry-run\.\n$/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('the plan does not warn about GitHub in a project on GitHub', () => {
  const root = project({ git: true });
  gitIn(root, 'remote', 'add', 'origin', 'https://github.com/someone/something.git');
  const { stdout } = run(root, ['--dry-run']);
  assert.doesNotMatch(stdout, /not on GitHub/);
});

test('without a terminal and without --yes nothing is written', () => {
  const root = project();
  const { code, stderr } = run(root, []);
  assert.equal(code, 1);
  assert.equal(stderr, 'chomik: run this in a terminal to confirm, or confirm in the command itself:\n  npx chomik@latest --yes\nNothing was changed.\n');
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('refuses to run outside a Node project', () => {
  const root = project({ packageJson: false });
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /no package\.json/);
  assert.equal(existsSync(join(root, '.claude')), false);
});

test('refuses to write through a symbolic link', () => {
  const root = project();
  const outside = mkdtempSync(join(tmpdir(), 'chomik-outside-'));
  symlinkSync(outside, join(root, '.claude'));
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /symbolic link/);
  assert.deepEqual(readdirSync(outside), []);
});

test('other files under .claude are left untouched', () => {
  const root = project();
  mkdirSync(join(root, '.claude', 'skills', 'other'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'other', 'SKILL.md'), 'keep me');
  run(root, ['--yes']);
  assert.equal(readFileSync(join(root, '.claude', 'skills', 'other', 'SKILL.md'), 'utf8'), 'keep me');
});

test('--help and -h print help and write nothing', () => {
  for (const flag of ['--help', '-h']) {
    const root = project();
    const { code, stdout } = run(root, [flag]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: npx chomik@latest \[options\]/);
    assert.match(stdout, /\.claude\/skills\/chomik\/README\.md/);
    assert.equal(existsSync(join(root, '.claude')), false);
  }
});

test('check runs the project\'s check script and passes outside CI', () => {
  const root = project();
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', SCRIPT), template(SCRIPT));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /^chomik: no reminders in \.chomik\/ yet\./);
});

test('check in a project without chomik introduces it with a prompt for an agent', () => {
  const { code, stdout, stderr } = run(project(), ['check']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /^chomik is not in this project yet\.\n\nBulletproof reminders/);
  assert.match(stderr, /Give chomik a chance to impress you: npx chomik@latest\nCurious first\? Paste this into your coding agent:\n {2}Read https:\/\/github\.com\/krzysztofryszawy\/chomik /);
});

test('check with the skill installed but not set up says how to finish', () => {
  const root = project();
  run(root, ['--yes']);
  const { code, stderr } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stderr, 'chomik is installed here, but its setup is not finished yet.\nTo finish, type /chomik in your coding agent.\n');
});

test('the skill README has the same FAQ as the README', () => {
  const faq = (text) => /\n## FAQ\n[\s\S]*?\n(?=## )/.exec(text)[0];
  assert.equal(faq(template('README.md').toString('utf8')), faq(readFileSync('README.md', 'utf8')));
});

test('the check pitch opens the README word for word', () => {
  const pitch = /const PITCH = `([^`]*)`/.exec(readFileSync(BIN, 'utf8'))[1];
  assert.ok(readFileSync('README.md', 'utf8').includes(`\n\n${pitch}\n\n`));
});

function setUp(root, script = template(SCRIPT)) {
  run(root, ['--yes']);
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', SCRIPT), script);
}

test('check adds nothing when the skill and its copies match', () => {
  const root = project();
  setUp(root);
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.doesNotMatch(stdout, /To update/);
});

test('check says when the copies are older than the skill', () => {
  const root = project();
  setUp(root, template(SCRIPT).toString('utf8').replace(`chomik ${VERSION}:`, 'chomik 0.1.0:'));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /\n\nchomik was updated, but its copies here are still 0\.1\.0\. To update them, type \/chomik in your coding agent\.\n$/);
});

test('check says when a newer chomik is out than the skill in the project', () => {
  const tag = (() => {
    try {
      return execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { encoding: 'utf8' }).split('\n')[0];
    } catch {
      return '';
    }
  })();
  if (!tag || tag.slice(1) === VERSION) return;
  const root = project();
  mkdirSync(join(root, SKILL_DIR), { recursive: true });
  for (const file of Object.keys(RELEASED[tag.slice(1)])) {
    writeFileSync(join(root, SKILL_DIR, file), execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]));
  }
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', SCRIPT), template(SCRIPT));
  const { stdout } = run(root, ['check']);
  assert.match(stdout, new RegExp(`\\n\\nchomik ${VERSION.replaceAll('.', '\\.')} is out; this project has ${tag.slice(1).replaceAll('.', '\\.')}\\. To update: npx chomik@latest\\n$`));
});

const releaseTags = (() => {
  try {
    return execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
})();

function withRelease(root, tag) {
  mkdirSync(join(root, SKILL_DIR), { recursive: true });
  for (const file of Object.keys(RELEASED[tag.slice(1)])) {
    writeFileSync(join(root, SKILL_DIR, file), execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]));
  }
  return root;
}

test('every older release is recognized and updated', () => {
  for (const tag of releaseTags.filter((t) => t.slice(1) !== VERSION && RELEASED[t.slice(1)])) {
    const root = withRelease(project(), tag);
    const { code, stdout } = run(root, ['--yes']);
    assert.equal(code, 0, tag);
    assert.match(stdout, new RegExp(`Updating chomik in this project: ${tag.slice(1).replaceAll('.', '\\.')} -> `), tag);
    for (const file of FILES) assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(template(file)), `${tag} ${file}`);
  }
});

test('skill files from different releases are treated as edited', () => {
  const tags = releaseTags.filter((t) => RELEASED[t.slice(1)]?.['setup.md']).sort();
  const [older, newest] = [tags[0], tags.at(-1)];
  if (!older || older === newest) return;
  const root = withRelease(project({ git: true }), newest);
  writeFileSync(join(root, SKILL_DIR, 'setup.md'), execFileSync('git', ['show', `${older}:template/.claude/skills/chomik/setup.md`]));
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'mixed');
  const { stdout } = run(root, ['--dry-run']);
  assert.match(stdout, /some of its files were edited here/);
});

test('a skill file deleted by hand is created again', () => {
  const root = project();
  run(root, ['--yes']);
  rmSync(join(root, SKILL_DIR, 'README.md'));
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, /create\s+\.claude\/skills\/chomik\/README\.md/);
  assert.doesNotMatch(stdout, /update|replace/);
});

test('an older chomik refuses to replace a newer skill unless forced', () => {
  const root = project();
  run(root, ['--yes']);
  const changelog = join(root, SKILL_DIR, 'CHANGELOG.md');
  writeFileSync(changelog, readFileSync(changelog, 'utf8').replace(/^## \[[^\]]+\]/m, '## [99.0.0]'));
  const refused = run(root, ['--yes']);
  assert.equal(refused.code, 1);
  assert.equal(refused.stderr, `chomik: this project has chomik 99.0.0, newer than ${VERSION} that you ran.\nTo update, run: npx chomik@latest\nTo go back to an older version on purpose, add --force.\nNothing was changed.\n`);
  assert.equal(run(root, ['--yes', '--force']).code, 0);
});

test('check says that copies without a version comment are older', () => {
  const root = project();
  setUp(root, template(SCRIPT).toString('utf8').replace(/^\/\/ 🐹 chomik [^:]+:/m, '// 🐹 chomik:'));
  assert.match(run(root, ['check']).stdout, /copies here are still an older version\. To update them, type \/chomik/);
});

test('check gives no hint when the copies are newer than the skill', () => {
  const root = project();
  setUp(root, template(SCRIPT).toString('utf8').replace(`chomik ${VERSION}:`, 'chomik 99.0.0:'));
  assert.doesNotMatch(run(root, ['check']).stdout, /To update/);
});

test('check gives no hint when the skill was edited', () => {
  const root = project();
  setUp(root);
  writeFileSync(join(root, SKILL_DIR, 'SKILL.md'), 'edited');
  assert.doesNotMatch(run(root, ['check']).stdout, /To update/);
});

test('install and check refuse to run below the repository root', () => {
  const root = project({ git: true });
  const sub = join(root, 'packages', 'api');
  mkdirSync(sub, { recursive: true });
  writeFileSync(join(sub, 'package.json'), '{}');
  for (const args of [['--yes'], ['check']]) {
    const { code, stdout, stderr } = run(sub, args);
    assert.equal(code, 1, args[0]);
    assert.equal(stdout, '', args[0]);
    assert.equal(stderr, `chomik: run this in the root of the repository, where GitHub reads workflows from:\n  cd ${root}\n`, args[0]);
  }
  assert.equal(existsSync(join(sub, '.claude')), false);
});

test('check refuses a check script that is a symbolic link', () => {
  const root = project();
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, 'elsewhere.mjs'), 'console.log("ran")');
  symlinkSync(join(root, 'elsewhere.mjs'), join(root, '.chomik', SCRIPT));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
});

test('check --help prints help and an unknown check option fails', () => {
  assert.match(run(project(), ['check', '--help']).stdout, /npx chomik check/);
  const { code, stderr } = run(project(), ['check', '--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /unknown argument "--yes"/);
});

test('--version prints the package version', () => {
  const { code, stdout } = run(project(), ['--version']);
  assert.equal(code, 0);
  assert.equal(stdout.trim(), VERSION);
});

test('an unknown argument such as the old "init" fails on stderr', () => {
  const { code, stdout, stderr } = run(project(), ['init']);
  assert.equal(code, 1);
  assert.equal(stderr, `chomik: unknown argument "init" in chomik ${VERSION}.\nIf it comes from a newer chomik, try: npx chomik@latest init\nHelp: npx chomik --help\n`);
  assert.equal(stdout, '');
});

test('the hint to try a newer chomik leaves out --yes and -y', () => {
  for (const yes of ['--yes', '-y']) {
    const { stderr } = run(project(), ['init', yes]);
    assert.match(stderr, /\nIf it comes from a newer chomik, try: npx chomik@latest init\n/, yes);
  }
});

test('a typo suggests the closest command or option', () => {
  for (const [typo, meant] of [['chek', 'check'], ['--hepl', '--help'], ['--dryrun', '--dry-run']]) {
    const { code, stderr } = run(project(), [typo]);
    assert.equal(code, 1, typo);
    assert.equal(stderr, `chomik: unknown argument "${typo}" in chomik ${VERSION}.\nDid you mean "${meant}"?\nHelp: npx chomik --help\n`, typo);
  }
});

test('-y works like --yes', () => {
  const root = project();
  assert.equal(run(root, ['-y']).code, 0);
  assert.ok(existsSync(skillFile(root)));
});

test('a deleted skill file is restored with a clear message', () => {
  const root = project();
  run(root, ['--yes']);
  rmSync(join(root, SKILL_DIR, 'setup.md'));
  assert.match(run(root, ['--dry-run']).stdout, new RegExp(`^Restoring missing chomik ${VERSION.replaceAll('.', '\\.')} files in this project\\.`));
});

test('check says how many reminders are unchecked when the check script is missing', () => {
  const root = project();
  run(root, ['--yes']);
  mkdirSync(join(root, '.chomik'));
  writeFileSync(join(root, '.chomik', `${new Date().toISOString().slice(0, 10)}-x.md`), 'x');
  const { code, stderr } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stderr, "chomik's check script is missing from .chomik/, so 1 reminder there is not checked.\nTo restore it, type /chomik in your coding agent.\n");
});

test('released-files.json matches the files of every release tag in this repository', () => {
  let tags = [];
  try {
    tags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  } catch {
    return;
  }
  // The tag of the version being released is the current version, not a past one.
  for (const tag of tags.filter((t) => t !== `v${VERSION}`)) {
    for (const file of Object.keys(RELEASED[tag.slice(1)] ?? { 'SKILL.md': 1 })) {
      const content = execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`]);
      const hash = createHash('sha256').update(content).digest('hex');
      assert.equal(RELEASED[tag.slice(1)]?.[file], hash, `${tag} ${file}`);
    }
  }
});


test('the changelog has an entry for the current version', () => {
  assert.match(template('CHANGELOG.md').toString('utf8'), new RegExp(`^## \\[${VERSION.replaceAll('.', '\\.')}\\] - `, 'm'));
});

test('the files copied into a project name the current chomik version', () => {
  for (const file of [SCRIPT, 'chomik-workflow.yml']) assert.match(template(file).toString('utf8').split('\n').slice(0, 2).join('\n'), new RegExp(`🐹 chomik ${VERSION.replaceAll('.', '\\.')}[ :]`));
});

test('the workflow templates pin every action to a full commit SHA', () => {
  for (const file of ['chomik-workflow.yml']) {
    const uses = readFileSync(join(TEMPLATE, file), 'utf8').match(/uses:\s*\S+/g) ?? [];
    assert.ok(uses.length > 0, file);
    for (const line of uses) assert.match(line, /@[0-9a-f]{40}$/, `${file}: ${line}`);
  }
});

test('the workflow template marks its own schedule and uses the shared name', () => {
  const text = readFileSync(join(TEMPLATE, 'chomik-workflow.yml'), 'utf8');
  assert.match(text, /workflow_call:/);
  assert.match(text, /# chomik: only without a daily build, begin\n[\s\S]*schedule:[\s\S]*# chomik: only without a daily build, end/);
  assert.match(text, /^ {2}looking-for-messages-from-the-past:$/m);
  assert.match(text, /node \.chomik\/looking-for-messages-from-the-past\.mjs --branch BRANCH/);
});
