import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
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
const prose = (text) => text.replace(/\n {2}/g, ' ');
const scriptTemplate = () => readFileSync(resolve('template/.chomik', SCRIPT));
const FILES = ['SKILL.md', 'README.md', 'CHANGELOG.md'];
const WORKFLOW = join('.github', 'workflows', 'chomik.yml');
const workflowSource = () => readFileSync(resolve('template', WORKFLOW));

function workspace() {
  const root = mkdtempSync(join(tmpdir(), 'chomik-workspace-'));
  for (const name of ['web', 'infra']) {
    mkdirSync(join(root, name));
    gitIn(join(root, name), 'init', '-q');
  }
  writeFileSync(join(root, 'web', 'package.json'), '{"name":"web"}\n');
  return root;
}

test('in a folder that holds repositories, both commands name them and change nothing', () => {
  const root = workspace();
  for (const [args, again] of [[['--yes'], 'npx chomik@latest'], [['check'], 'npx chomik check']]) {
    const { code, stdout, stderr } = run(root, args);
    assert.equal(code, 1, args[0]);
    assert.equal(stdout, '');
    assert.equal(stderr, `chomik: this folder is not a git repository, but it holds 2: infra, web.\nchomik works in one repository, the one whose build checks its reminders. Run it there, for example:\n  cd infra && ${again}\n`);
  }
  assert.deepEqual(readdirSync(root).sort(), ['infra', 'web']);
});

test('a folder with many repositories names five of them', () => {
  const root = mkdtempSync(join(tmpdir(), 'chomik-workspace-'));
  for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
    mkdirSync(join(root, name));
    gitIn(join(root, name), 'init', '-q');
  }
  assert.match(run(root, ['--yes']).stderr, /^chomik: this folder is not a git repository, but it holds 7: a, b, c, d, e and 2 more\.\n/);
});

test('a repository with other repositories inside still installs in its own root', () => {
  const root = project({ git: true });
  mkdirSync(join(root, 'vendor'));
  gitIn(join(root, 'vendor'), 'init', '-q');
  assert.equal(run(root, ['--yes']).code, 0);
});

test('outside GitHub, npx chomik --yes installs the skill and the check script, and no workflow', () => {
  const root = project();
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Installing chomik ${VERSION.replaceAll('.', '\\.')} in this project`));
  assert.match(stdout, /create\s+\.claude\/skills\/chomik\/SKILL\.md/);
  assert.match(stdout, /create\s+\.chomik\/looking-for-messages-from-the-past\.mjs \(checks the reminders\)/);
  assert.match(stdout, /This project is not on GitHub yet, so there is no nightly check for now\./);
  assert.match(stdout, /Until this project is on GitHub, reminders show when you run npx chomik check\.\nOnce it is, run npx chomik@latest again to add the nightly check\.\n\nNext: open your coding agent here, Claude Code or GitHub Copilot, and type\n\/chomik\. It will show you around and help you leave your first reminder\.\n$/);
  assert.ok(stdout.split('\n').every((line) => line.length <= 80));
  assert.doesNotMatch(stdout, /Feel free to share chomik/);
  assert.deepEqual(readdirSync(join(root, SKILL_DIR)).sort(), [...FILES].sort());
  for (const file of FILES) assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(template(file)));
  assert.deepEqual(readdirSync(join(root, '.chomik')), [SCRIPT]);
  assert.ok(readFileSync(join(root, '.chomik', SCRIPT)).equals(scriptTemplate()));
  assert.deepEqual(readdirSync(root).sort(), ['.chomik', '.claude', 'package.json']);
});

test('on GitHub, one install also adds the nightly workflow and says how to switch it on', () => {
  const root = project({ git: true });
  gitIn(root, 'remote', 'add', 'origin', 'https://github.com/someone/something.git');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, /create\s+\.github\/workflows\/chomik\.yml \(runs the check every night on GitHub\)/);
  assert.match(stdout, /Commit these files and push them to your main branch: from then on GitHub\nchecks your reminders every night, and your whole team can leave them\.\n/);
  assert.ok(readFileSync(join(root, WORKFLOW)).equals(workflowSource()));
  assert.ok(stdout.split('\n').every((line) => line.length <= 80));
});

test('a project that moved to GitHub gets the nightly workflow on the next run', () => {
  const root = project({ git: true });
  run(root, ['--yes']);
  gitIn(root, 'remote', 'add', 'origin', 'git@github.com:someone/something.git');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, /^Adding chomik's nightly check on GitHub to this project\.\nPlan:\n {2}create {3}\.github\/workflows\/chomik\.yml/);
  assert.match(stdout, /Done\. Commit \.github\/workflows\/chomik\.yml and push it to your main branch:/);
});

function inDailyBuild(root) {
  writeFileSync(join(root, '.github', 'workflows', 'build.yml'), 'on:\n  schedule:\n    - cron: "0 3 * * *"\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n  looking-for-messages-from-the-past:\n    uses: ./.github/workflows/chomik.yml\n');
  const text = readFileSync(join(root, WORKFLOW), 'utf8');
  writeFileSync(join(root, WORKFLOW), text.replace(/^ *# chomik: only without a daily build, begin\n[\s\S]*?^ *# chomik: only without a daily build, end\n/m, ''));
}

test('a workflow moved into the daily build by the agent stays without its own schedule on update', () => {
  const root = project({ git: true });
  gitIn(root, 'remote', 'add', 'origin', 'https://github.com/someone/something.git');
  run(root, ['--yes']);
  inDailyBuild(root);
  const moved = readFileSync(join(root, WORKFLOW));
  assert.match(run(root, ['--yes']).stdout, /is already here and up to date/);
  rmSync(join(root, WORKFLOW));
  const { stdout } = run(root, ['--yes']);
  assert.match(stdout, /create\s+\.github\/workflows\/chomik\.yml \(called by your daily build\)/);
  assert.ok(readFileSync(join(root, WORKFLOW)).equals(moved));
  assert.doesNotMatch(moved.toString('utf8'), /schedule:/);
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
  if (releasedFile(tag, 'SKILL.md').equals(template('SKILL.md'))) return;
  const root = withRelease(project(), tag);
  const version = tag.slice(1).replaceAll('.', '\\.');
  const { code, stdout } = run(root, ['--yes']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`Updating chomik in this project: ${version} -> `));
  assert.match(stdout, new RegExp(`Done\\. chomik is now ${VERSION.replaceAll('.', '\\.')}\\.\\nFeel free to share chomik with your team: commit [^\\n]*\\.\\n$`));
  assert.match(stdout, /update\s+\.claude\/skills\/chomik\/SKILL\.md/);
  assert.ok(readFileSync(skillFile(root)).equals(template('SKILL.md')));
});

test('uncommitted edits block the whole update and nothing is written', () => {
  const root = project({ git: true });
  run(root, ['--yes']);
  gitIn(root, 'add', '-A');
  gitIn(root, 'commit', '-qm', 'chomik');
  writeFileSync(skillFile(root), 'my uncommitted edit');
  writeFileSync(join(root, '.chomik', SCRIPT), 'old');
  const { code, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.match(stderr, /would be lost for good/);
  assert.equal(readFileSync(skillFile(root), 'utf8'), 'my uncommitted edit');
  assert.equal(readFileSync(join(root, '.chomik', SCRIPT), 'utf8'), 'old');
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
  assert.match(stdout, /This project is not on GitHub yet, so there is no nightly check for now\./);
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

test('outside a Node project, introduces chomik and installs nothing', () => {
  const root = project({ packageJson: false });
  const { code, stdout, stderr } = run(root, ['--yes']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /^chomik: this folder is not a Node project, so there is nothing to install it in\.\n\nBulletproof reminders/);
  assert.match(stderr, /To try it, run this in the root of a Node project: npx chomik@latest\nCurious first\? Paste this into your coding agent:\n\n {2}Read https:\/\/github\.com\/krzysztofryszawy\/chomik /);
  assert.deepEqual(readdirSync(root), []);
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
  writeFileSync(join(root, '.chomik', SCRIPT), scriptTemplate());
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /^chomik: no reminders in \.chomik\/ right now\./);
});

test('check in a project without chomik introduces it with a prompt for an agent', () => {
  const { code, stdout, stderr } = run(project(), ['check']);
  assert.equal(code, 1);
  assert.equal(stdout, '');
  assert.match(stderr, /^chomik is not in this project yet\.\n\nBulletproof reminders/);
  assert.match(stderr, /Give chomik a chance to impress you: npx chomik@latest\nCurious first\? Paste this into your coding agent:\n\n {2}Read https:\/\/github\.com\/krzysztofryszawy\/chomik /);
});

test('check with the check script deleted says how to restore it', () => {
  const root = project();
  run(root, ['--yes']);
  rmSync(join(root, '.chomik', SCRIPT));
  const { code, stderr } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stderr, "chomik's check script is missing from .chomik/.\nTo restore it, run: npx chomik@latest\n");
});

test('the skill README has the same FAQ as the README', () => {
  const faq = (text) => /\n## FAQ\n[\s\S]*?\n(?=## )/.exec(text)[0];
  assert.equal(faq(template('README.md').toString('utf8')), faq(readFileSync('README.md', 'utf8')));
});

test('the check pitch opens the README word for word', () => {
  const pitch = /const PITCH = `([^`]*)`/.exec(readFileSync(BIN, 'utf8'))[1];
  assert.ok(readFileSync('README.md', 'utf8').includes(`\n\n${pitch}\n\n`));
});

const workflowTemplate = (version = VERSION) => workflowSource().toString('utf8').replace(`chomik ${VERSION} `, `chomik ${version} `);

function setUp(root, script = scriptTemplate(), workflow = workflowTemplate()) {
  run(root, ['--yes']);
  writeFileSync(join(root, '.chomik', SCRIPT), script);
  if (workflow !== null) {
    mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(root, '.github', 'workflows', 'chomik.yml'), workflow);
  }
}

test('check adds nothing when chomik, its script and its workflow match', () => {
  const root = project();
  setUp(root);
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /^chomik: no reminders in \.chomik\/ right now\.\nTo leave one, .*\n$/);
});

test('check on GitHub without the workflow says how to add it', () => {
  const root = project({ git: true });
  gitIn(root, 'remote', 'add', 'origin', 'https://github.com/someone/something.git');
  run(root, ['--yes']);
  rmSync(join(root, WORKFLOW));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /\n\nThe nightly check on GitHub is missing, so reminders show only when you run this\. To add it, run: npx chomik@latest\n$/);
});

test('check outside GitHub says when the nightly check comes', () => {
  const root = project();
  run(root, ['--yes']);
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, /\n\nThis project is not on GitHub yet, so reminders show only when you run this\. Once it is, run npx chomik@latest again to add the nightly check\.\n$/);
});

test('check says when the check script is older than the skill', () => {
  const root = project();
  setUp(root, scriptTemplate().toString('utf8').replace(`chomik ${VERSION}:`, 'chomik 0.1.0:'));
  const { code, stdout } = run(root, ['check']);
  assert.equal(code, 0);
  assert.match(stdout, new RegExp(`\\n\\nThe check script in \\.chomik/ is older than chomik ${VERSION.replaceAll('.', '\\.')} here\\. To update it, run: npx chomik@latest\\n$`));
});

test('check says when the CI workflow is older than the skill', () => {
  const root = project();
  setUp(root, scriptTemplate(), workflowTemplate('0.1.0'));
  const { stdout } = run(root, ['check']);
  assert.match(stdout, /\n\nchomik was updated, but \.github\/workflows\/chomik\.yml is still 0\.1\.0\. To update it, run: npx chomik@latest\n$/);
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
  const root = withRelease(project(), tag);
  mkdirSync(join(root, '.chomik'), { recursive: true });
  writeFileSync(join(root, '.chomik', SCRIPT), scriptTemplate());
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

const OWN_SCHEDULE = /^ *# chomik: only without a daily build, begin\n[\s\S]*?^ *# chomik: only without a daily build, end\n/m;

// Up to 0.1.7 every file sat in the skill folder; later the check script is in template/.chomik/,
// and from 0.1.12 the workflow is in template/.github/workflows/, in two forms.
function releasedFile(tag, file) {
  if (file.startsWith('chomik.yml')) {
    const workflow = execFileSync('git', ['show', `${tag}:template/.github/workflows/chomik.yml`], { encoding: 'utf8' });
    return Buffer.from(file === 'chomik.yml#called' ? workflow.replace(OWN_SCHEDULE, '') : workflow);
  }
  try {
    return execFileSync('git', ['show', `${tag}:template/.claude/skills/chomik/${file}`], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return execFileSync('git', ['show', `${tag}:template/.chomik/${file}`]);
  }
}

function withRelease(root, tag) {
  mkdirSync(join(root, SKILL_DIR), { recursive: true });
  const scriptInSkill = releasedFromSkillFolder(tag, SCRIPT);
  for (const file of Object.keys(RELEASED[tag.slice(1)]).filter((f) => !f.startsWith('chomik.yml'))) {
    const dir = file === SCRIPT && !scriptInSkill ? '.chomik' : SKILL_DIR;
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, file), releasedFile(tag, file));
  }
  return root;
}

function releasedFromSkillFolder(tag, file) {
  try {
    execFileSync('git', ['cat-file', '-e', `${tag}:template/.claude/skills/chomik/${file}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

test('every older release is recognized and updated', () => {
  for (const tag of releaseTags.filter((t) => t.slice(1) !== VERSION && RELEASED[t.slice(1)])) {
    const root = withRelease(project(), tag);
    const { code, stdout } = run(root, ['--yes']);
    assert.equal(code, 0, tag);
    assert.match(stdout, new RegExp(`Updating chomik in this project: ${tag.slice(1).replaceAll('.', '\\.')} -> `), tag);
    for (const file of FILES) assert.ok(readFileSync(join(root, SKILL_DIR, file)).equals(template(file)), `${tag} ${file}`);
    assert.ok(readFileSync(join(root, '.chomik', SCRIPT)).equals(scriptTemplate()), tag);
  }
});

test('skill files from different releases are treated as edited', () => {
  const tags = releaseTags.filter((t) => RELEASED[t.slice(1)]?.['README.md'] && RELEASED[t.slice(1)]?.['CHANGELOG.md']).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const [older, newest] = [tags[0], tags.at(-1)];
  if (!older || older === newest) return;
  const root = withRelease(project({ git: true }), newest);
  writeFileSync(join(root, SKILL_DIR, 'SKILL.md'), execFileSync('git', ['show', `${older}:template/.claude/skills/chomik/SKILL.md`]));
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

test('check gives no hint when the check script is newer than the skill', () => {
  const root = project();
  setUp(root, scriptTemplate().toString('utf8').replace(`chomik ${VERSION}:`, 'chomik 99.0.0:'));
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

test('an old Node stops every command with a clear message', () => {
  const minimum = Number(/\d+/.exec(JSON.parse(readFileSync('package.json', 'utf8')).engines.node)[0]);
  const fake = `data:text/javascript,Object.defineProperty(process.versions,"node",{value:"${minimum - 1}.0.0"})`;
  for (const args of [[], ['check'], ['--yes']]) {
    const root = project();
    const result = spawnSync(process.execPath, ['--import', fake, BIN, ...args], { cwd: root, encoding: 'utf8', input: '' });
    assert.equal(result.status, 1, args.join(' '));
    assert.equal(result.stderr, `chomik needs Node ${minimum} or newer; this is Node ${minimum - 1}.0.0.\nUpdate Node: https://nodejs.org\n`);
    assert.equal(existsSync(join(root, '.claude')), false);
  }
});

test('--version prints the package version', () => {
  const { code, stdout } = run(project(), ['--version']);
  assert.equal(code, 0);
  assert.equal(stdout.trim(), VERSION);
});

test('an unknown argument such as the old "init" fails on stderr', () => {
  const { code, stdout, stderr } = run(project(), ['init']);
  assert.equal(code, 1);
  assert.equal(stderr, `chomik: unknown argument "init" in chomik ${VERSION}.\nIf it comes from a newer chomik, try: npx chomik@latest init\nHelp: npx chomik@latest --help\n`);
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
    assert.equal(stderr, `chomik: unknown argument "${typo}" in chomik ${VERSION}.\nDid you mean "${meant}"?\nHelp: npx chomik@latest --help\n`, typo);
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
  rmSync(join(root, SKILL_DIR, 'README.md'));
  assert.match(run(root, ['--dry-run']).stdout, new RegExp(`^Restoring missing chomik ${VERSION.replaceAll('.', '\\.')} files in this project\\.`));
});

test('check says how many reminders are unchecked when the check script is missing', () => {
  const root = project();
  run(root, ['--yes']);
  rmSync(join(root, '.chomik', SCRIPT));
  writeFileSync(join(root, '.chomik', `${new Date().toISOString().slice(0, 10)}-x.md`), 'x');
  const { code, stderr } = run(root, ['check']);
  assert.equal(code, 1);
  assert.equal(stderr, "chomik's check script is missing from .chomik/, so 1 reminder there is not checked.\nTo restore it, run: npx chomik@latest\n");
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
      const content = releasedFile(tag, file);
      const hash = createHash('sha256').update(content).digest('hex');
      assert.equal(RELEASED[tag.slice(1)]?.[file], hash, `${tag} ${file}`);
    }
  }
});

test('after a release, the script records both workflow forms the installer writes', () => {
  const repo = mkdtempSync(join(tmpdir(), 'chomik-release-'));
  for (const path of ['package.json', 'bin', 'template']) cpSync(resolve(path), join(repo, path), { recursive: true });
  gitIn(repo, 'init', '-q');
  gitIn(repo, 'add', '-A');
  gitIn(repo, 'commit', '-qm', 'release');
  gitIn(repo, 'tag', `v${VERSION}`);
  const result = spawnSync(process.execPath, [resolve('scripts/after-release.mjs')], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const recorded = JSON.parse(readFileSync(join(repo, 'bin', 'released-files.json'), 'utf8'))[VERSION];

  const root = project({ git: true });
  gitIn(root, 'remote', 'add', 'origin', 'https://github.com/someone/something.git');
  run(root, ['--yes']);
  assert.equal(createHash('sha256').update(readFileSync(join(root, WORKFLOW))).digest('hex'), recorded['chomik.yml']);
  inDailyBuild(root);
  rmSync(join(root, WORKFLOW));
  run(root, ['--yes']);
  assert.equal(createHash('sha256').update(readFileSync(join(root, WORKFLOW))).digest('hex'), recorded['chomik.yml#called']);

  const next = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).version;
  assert.notEqual(next, VERSION);
  assert.match(readFileSync(join(repo, 'template', WORKFLOW), 'utf8'), new RegExp(`chomik ${next.replaceAll('.', '\\.')} `));
  assert.match(readFileSync(join(repo, 'template', '.claude', 'skills', 'chomik', 'CHANGELOG.md'), 'utf8'), new RegExp(`^## \\[${next.replaceAll('.', '\\.')}\\] - unreleased$`, 'm'));
});

test('the changelog has an entry for the current version', () => {
  assert.match(template('CHANGELOG.md').toString('utf8'), new RegExp(`^## \\[${VERSION.replaceAll('.', '\\.')}\\] - `, 'm'));
});

test('the files copied into a project name the current chomik version', () => {
  for (const content of [scriptTemplate(), workflowSource()]) assert.match(content.toString('utf8').split('\n').slice(0, 2).join('\n'), new RegExp(`🐹 chomik ${VERSION.replaceAll('.', '\\.')}[ :]`));
});

test('the workflow templates pin every action to a full commit SHA', () => {
  for (const file of [resolve('template', WORKFLOW)]) {
    const uses = readFileSync(file, 'utf8').match(/uses:\s*\S+/g) ?? [];
    assert.ok(uses.length > 0, file);
    for (const line of uses) assert.match(line, /@[0-9a-f]{40}$/, `${file}: ${line}`);
  }
});

test('the workflow runs nightly, can be called by a build, and reads the default branch at run time', () => {
  const text = workflowSource().toString('utf8');
  assert.match(text, /^name: "🐹 chomik: looking for messages from the past"$/m);
  assert.match(text, /workflow_call:/);
  assert.match(text, /# chomik: only without a daily build, begin\n {2}schedule:\n {4}- cron: [^\n]*\n {2}# chomik: only without a daily build, end\n/);
  assert.doesNotMatch(text, /push:|--branch BRANCH/);
  assert.match(text, /^ {2}looking-for-messages-from-the-past:$/m);
  assert.match(text, /DEFAULT_BRANCH: \$\{\{ github\.event\.repository\.default_branch \}\}\n {8}run: node \.chomik\/looking-for-messages-from-the-past\.mjs --branch "\$DEFAULT_BRANCH"/);
});
