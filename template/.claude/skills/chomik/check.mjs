#!/usr/bin/env node
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
    if (error.code === 'ENOENT') return 0;
    throw error;
  }

  const today = new Date().toISOString().slice(0, 10);
  const due = [];
  const invalid = [];

  // Symbolic links and folders are skipped on purpose, so the check never reads outside .chomik.
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith('.md')).sort(byName)) {
    const match = REMINDER_NAME.exec(entry.name);
    if (!match || !isRealDate(match[1], match[2], match[3])) {
      invalid.push(entry.name);
    } else if (entry.name.slice(0, 10) <= today) {
      due.push(entry.name);
    }
  }

  if (due.length === 0 && invalid.length === 0) return 0;

  if (inActions) {
    if (due.length) console.log('::error title=chomik::chomik sent a message from the past');
    if (invalid.length) console.log('::error title=chomik::chomik found an invalid reminder file');
  }

  // Reminder text is untrusted, so GitHub workflow commands are switched off while it is printed.
  const token = inActions ? randomUUID() : null;
  if (token) console.log(`::stop-commands::${token}`);

  for (const name of due) {
    const text = readFileSync(join(DIR, name), 'utf8').replace(/\r\n/g, '\n');
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

  console.log('');
  console.log('Run locally: node .chomik/check.mjs');
  if (!enforce) {
    if (!inActions) console.log('Not failing outside CI.');
    else if (!branch) console.log('Not failing: no branch given with --branch.');
    else console.log(`Not failing: the build fails only on branch "${branch}".`);
  }

  if (token) console.log(`::${token}::`);

  if (!enforce) return 0;
  return invalid.length ? 2 : 1;
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
