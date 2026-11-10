#!/usr/bin/env node
// 🐹 chomik 0.1.12: looks for messages from the past in .chomik/. About chomik: .claude/skills/chomik/README.md
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DIR = '.chomik';
const SCRIPT = 'looking-for-messages-from-the-past.mjs';
const REMINDER_NAME = /^(\d{4})-(\d{2})-(\d{2})-[a-z0-9][a-z0-9-]*\.md$/;
const PROMPT_HEADING = /^#{1,6}\s+prompt\s*$/i;
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

  // Everything in .chomik is a reminder or reported, since a skipped file is a reminder
  // that silently never shows. Symbolic links are reported, never followed.
  for (const entry of entries.sort(byName)) {
    if (entry.name === SCRIPT && entry.isFile()) continue;
    const reason = problem(entry);
    if (reason) {
      invalid.push({ name: entry.name, reason });
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
    if (invalid.length) console.log('::error title=chomik::chomik found a file in .chomik that is not a valid reminder');
    if (newer.length) console.log('::error title=chomik::chomik found a reminder it cannot read');
  }

  // Reminder text is untrusted, so GitHub workflow commands are switched off while it is printed.
  const token = inActions ? randomUUID() : null;
  if (token) console.log(`::stop-commands::${token}`);

  let printed = false;
  const section = (lines) => {
    if (printed) console.log('');
    for (const line of lines) console.log(line);
    printed = true;
  };

  for (const name of due) {
    const { body: text } = parse(readFileSync(join(DIR, name), 'utf8'));
    const prompt = promptPart(text, join(DIR, name));
    const lines = [`chomik sent a message from the past: ${join(DIR, name)}`];
    if (prompt) {
      lines.push('Paste the prompt below into a coding agent session in this repository.');
      lines.push('To read yourself what needs to be done, see FOR HUMANS below the prompt.');
      lines.push('', '===== PROMPT =====', `This reminder is in ${join(DIR, name)}.`, prompt, '===== END OF PROMPT =====');
    }
    lines.push('', '===== FOR HUMANS =====', humanPart(text, join(DIR, name)), '===== END =====');
    section(lines);
  }

  if (invalid.length) {
    section([
      'chomik found files in .chomik/ that are not valid reminders:',
      ...invalid.map(({ name, reason }) => `  ${join(DIR, name)}: ${reason}`),
    ]);
  }

  if (newer.length) {
    section([
      'chomik cannot read these reminders: their header asks for a newer chomik, or has a mistake.',
      'This chomik reads "chomik: 1" and "condition: date". To update chomik: npx chomik@latest',
      ...newer.map((name) => `  ${join(DIR, name)}`),
    ]);
  }

  const footer = inActions ? ['Run locally: npx chomik check'] : [];
  if (!enforce) {
    if (!inActions) footer.push('Not failing outside CI.');
    else if (!branch) footer.push('Not failing: no branch given with --branch.');
    else footer.push(`Not failing: the build fails only on branch "${branch}".`);
  }
  section(footer);

  if (token) console.log(`::${token}::`);

  if (!enforce) return 0;
  return invalid.length || newer.length ? 2 : 1;
}

function problem(entry) {
  if (entry.isSymbolicLink()) return 'a symbolic link, which chomik does not follow';
  if (entry.isDirectory()) return 'a folder; chomik reads only files directly in .chomik/';
  if (!entry.isFile()) return 'not a regular file';
  const match = REMINDER_NAME.exec(entry.name);
  if (!match) return 'expected a name like YYYY-MM-DD-what-to-revisit.md, in lowercase';
  if (!isRealDate(match[1], match[2], match[3])) return 'that date does not exist';
  const { header, body } = parse(readFileSync(join(DIR, entry.name), 'utf8'));
  if (!header && body.trim() === '') return 'the file is empty';
  if (!header) return 'it does not start with the header (chomik: 1, condition: date)';
  if (body.trim() === '') return 'nothing after the header';
  return '';
}

// Unknown formats and conditions come from a newer chomik; skipping them could hide a reminder.
function understood(header) {
  return header.chomik === '1' && header.condition === 'date';
}

function nothingDue(waiting) {
  if (waiting.length === 0) {
    console.log(`chomik: no reminders in ${DIR}/ right now.`);
    console.log('To leave one, type /chomik in your coding agent. More: .claude/skills/chomik/README.md');
  } else {
    const next = waiting[0].slice(0, 10);
    console.log('chomik found no messages from the past for today.');
    console.log(waiting.length === 1
      ? `1 reminder is waiting; it is due on ${next}.`
      : `${waiting.length} reminders are waiting; the next one is due on ${next}.`);
  }
  return 0;
}

// A reminder starts with a YAML header such as "chomik: 1" and "condition: date";
// only flat "key: value" lines are read.
function parse(raw) {
  const lines = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').split('\n');
  const end = lines[0] === '---' ? lines.indexOf('---', 1) : -1;
  if (end === -1) return { header: null, body: lines.join('\n') };
  const header = {};
  for (const line of lines.slice(1, end)) {
    const match = /^([A-Za-z][\w-]*):\s*(.*?)\s*$/.exec(line);
    if (match) header[match[1]] = match[2];
  }
  return { header, body: lines.slice(end + 1).join('\n') };
}

function humanPart(text, file) {
  const lines = [];
  for (const line of text.split('\n')) {
    if (PROMPT_HEADING.test(line)) break;
    lines.push(line);
  }
  return limit(trimBlank(lines), MAX_LINES, file);
}

// The prompt is everything after the "## Prompt" heading. Only the fence around all
// of it is dropped, so code blocks inside the prompt never cut it short.
function promptPart(text, file) {
  const lines = text.split('\n');
  const start = lines.findIndex((line) => PROMPT_HEADING.test(line));
  if (start === -1) return '';
  let body = trimBlank(lines.slice(start + 1));
  const open = /^(`{3,}|~{3,})/.exec(body[0] ?? '');
  const close = /^(`{3,}|~{3,})\s*$/.exec(body.at(-1) ?? '');
  if (open && close && body.length > 1 && close[1][0] === open[1][0] && close[1].length >= open[1].length) {
    body = trimBlank(body.slice(1, -1));
  }
  return limit(body, MAX_PROMPT_LINES, file);
}

function trimBlank(lines) {
  let from = 0;
  let to = lines.length;
  while (from < to && lines[from].trim() === '') from++;
  while (to > from && lines[to - 1].trim() === '') to--;
  return lines.slice(from, to);
}

function limit(lines, max, file) {
  if (lines.length <= max) return lines.join('\n');
  return [...lines.slice(0, max), `... (cut after ${max} lines; the rest is in ${file})`].join('\n');
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
