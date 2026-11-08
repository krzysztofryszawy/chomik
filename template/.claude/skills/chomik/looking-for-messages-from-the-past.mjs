#!/usr/bin/env node
// 🐹 chomik 0.1.7: looks for messages from the past in .chomik/. About chomik: .claude/skills/chomik/README.md
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DIR = '.chomik';
const REMINDER_NAME = /^(\d{4})-(\d{2})-(\d{2})-[a-z0-9][a-z0-9-]*\.md$/;
const PROMPT_HEADING = /^#{1,6}\s+prompt\b/i;
const MAX_LINES = 40;
const MAX_PROMPT_LINES = 200;

const env = process.env;
const inActions = env.GITHUB_ACTIONS === 'true';
const branch = argValue('--branch');
const enforce = inActions && Boolean(branch) && env.GITHUB_REF_TYPE === 'branch' && env.GITHUB_REF_NAME === branch;

try {
  process.exitCode = run();
} catch (error) {
  console.log(`chomik: checker error: ${error.message}`);
  process.exitCode = enforce ? 2 : 0;
}

function run() {
  let entries;
  try {
    entries = readdirSync(DIR, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return nothingDue([]);
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);
  const due = [];
  const waiting = [];
  const invalid = [];
  const newer = [];

  // Symbolic links and folders are skipped on purpose, so the check never reads outside .chomik.
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith('.md')).sort(byName)) {
    const match = REMINDER_NAME.exec(entry.name);
    if (!match || !isRealDate(match[1], match[2], match[3])) {
      invalid.push(entry.name);
    } else if (!understood(parse(readFileSync(join(DIR, entry.name), 'utf8')).header)) {
      newer.push(entry.name);
    } else if (entry.name.slice(0, 10) <= today) {
      due.push(entry.name);
    } else {
      waiting.push(entry.name);
    }
  }

  if (due.length === 0 && invalid.length === 0 && newer.length === 0) return nothingDue(waiting);

  if (inActions) {
    if (due.length) console.log('::error title=chomik::chomik sent a message from the past');
    if (invalid.length) console.log('::error title=chomik::chomik found an invalid reminder file');
    if (newer.length) console.log('::error title=chomik::chomik found a reminder that needs a newer chomik');
  }

  // Reminder text is untrusted, so GitHub workflow commands are switched off while it is printed.
  const token = inActions ? randomUUID() : null;
  if (token) console.log(`::stop-commands::${token}`);

  for (const name of due) {
    const { body: text } = parse(readFileSync(join(DIR, name), 'utf8'));
    const prompt = promptPart(text);
    if (name !== due[0]) console.log('');
    console.log(`chomik sent a message from the past: ${join(DIR, name)}`);
    if (prompt) {
      console.log('Paste the prompt below into a coding agent session in this repository.');
      console.log('To read yourself what needs to be done, see FOR HUMANS below the prompt.');
      console.log('');
      console.log('===== PROMPT =====');
      console.log(prompt);
      console.log('===== END OF PROMPT =====');
    }
    console.log('');
    console.log('===== FOR HUMANS =====');
    console.log(humanPart(text));
    console.log('===== END =====');
  }

  if (invalid.length) {
    console.log('');
    console.log('chomik found an invalid reminder file (expected .chomik/YYYY-MM-DD-name.md):');
    for (const name of invalid) console.log(`  ${join(DIR, name)}`);
  }

  if (newer.length) {
    console.log('');
    console.log('chomik found a reminder that needs a newer chomik. Update: npx chomik@latest');
    for (const name of newer) console.log(`  ${join(DIR, name)}`);
  }

  console.log('');
  console.log('Run locally: npx chomik check');
  if (!enforce) {
    if (!inActions) console.log('Not failing outside CI.');
    else if (!branch) console.log('Not failing: no branch given with --branch.');
    else console.log(`Not failing: the build fails only on branch "${branch}".`);
  }

  if (token) console.log(`::${token}::`);

  if (!enforce) return 0;
  return invalid.length || newer.length ? 2 : 1;
}

// Unknown formats and conditions come from a newer chomik; skipping them could hide a reminder.
function understood(header) {
  return (header.chomik ?? '1') === '1' && (header.condition ?? 'date') === 'date';
}

function nothingDue(waiting) {
  if (waiting.length === 0) {
    console.log(`chomik: no reminders in ${DIR}/ yet.`);
    console.log('To leave one, type /chomik in your coding agent. Help: npx chomik@latest --help');
  } else {
    const next = waiting[0].slice(0, 10);
    console.log('chomik found no messages from the past for today.');
    console.log(waiting.length === 1
      ? `1 reminder is waiting; it is due on ${next}.`
      : `${waiting.length} reminders are waiting; the next one is due on ${next}.`);
  }
  return 0;
}

// A reminder may start with a YAML header such as "chomik: 1" and "condition: date";
// only flat "key: value" lines are read. Without a header it is format 1.
function parse(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const header = {};
  if (lines[0] !== '---') return { header, body: lines.join('\n') };
  const end = lines.indexOf('---', 1);
  if (end === -1) return { header, body: lines.join('\n') };
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match) header[match[1]] = match[2];
  }
  return { header, body: lines.slice(end + 1).join('\n') };
}

function humanPart(text) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (PROMPT_HEADING.test(line)) break;
    lines.push(line);
  }
  return limit(trimBlank(lines), MAX_LINES);
}

function promptPart(text) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => PROMPT_HEADING.test(line));
  if (start === -1) return '';
  let body = lines.slice(start + 1);
  const open = body.findIndex((line) => line.startsWith('```'));
  if (open !== -1) {
    const close = body.findIndex((line, i) => i > open && line.startsWith('```'));
    body = body.slice(open + 1, close === -1 ? undefined : close);
  }
  return limit(trimBlank(body), MAX_PROMPT_LINES);
}

function trimBlank(lines) {
  let from = 0;
  let to = lines.length;
  while (from < to && lines[from].trim() === '') from++;
  while (to > from && lines[to - 1].trim() === '') to--;
  return lines.slice(from, to);
}

function limit(lines, max) {
  return (lines.length > max ? [...lines.slice(0, max), '...'] : lines).join('\n');
}

function isRealDate(year, month, day) {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() === Number(month) - 1
    && date.getUTCDate() === Number(day);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function byName(a, b) {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}
