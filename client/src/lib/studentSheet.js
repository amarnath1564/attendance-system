const normalize = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

function matchHeader(header) {
  const h = normalize(header);
  if (/applic|admission|adm ?no/.test(h)) return 'application_number';
  if (/^roll/.test(h) || /roll ?no/.test(h) || /roll ?number/.test(h)) return 'roll_number';
  if (/name|student/.test(h)) return 'name';
  if (/mail/.test(h)) return 'email';
  if (/status|active|inactive/.test(h)) return 'status';
  return null;
}

const REQUIRED = ['application_number', 'roll_number', 'name'];

export function findHeaderRow(rows, maxScan = 6) {
  for (let i = 0; i < Math.min(rows.length, maxScan); i += 1) {
    const cols = rows[i].map((c) => c.trim()).filter((c) => c !== '');
    if (cols.length === 0) continue;
    const matched = new Set();
    for (const col of cols) {
      const key = matchHeader(col);
      if (key) matched.add(key);
    }
    if (REQUIRED.every((r) => matched.has(r))) return i;
  }
  return -1;
}

export function parseStudentRows(rows) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        'Could not find a valid header row. Required columns: Application Number, Roll Number, Student Name. Email and Status are optional.',
      missingColumns: REQUIRED,
      students: [],
    };
  }

  const headers = rows[headerIndex];
  const columns = {};
  headers.forEach((h, idx) => {
    const key = matchHeader(h);
    if (key && !(key in columns)) columns[key] = idx;
  });

  const missing = REQUIRED.filter((r) => !(r in columns));
  if (missing.length) {
    const names = {
      application_number: 'Application Number',
      roll_number: 'Roll Number',
      name: 'Student Name',
    };
    return {
      ok: false,
      error: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing
        .map((m) => names[m])
        .join(', ')}.`,
      missingColumns: missing,
      students: [],
    };
  }

  const students = [];
  const seen = new Map();
  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.some((c) => String(c).trim() !== '')) continue;
    const app = (row[columns.application_number] ?? '').toString().trim();
    const roll = (row[columns.roll_number] ?? '').toString().trim();
    const name = (row[columns.name] ?? '').toString().trim();
    const email = columns.email != null ? (row[columns.email] ?? '').toString().trim() : '';
    const statusRaw = columns.status != null ? (row[columns.status] ?? '').toString().trim() : '';
    if (!name && !app && !roll) continue;
    if (!name) continue;

    const status = /inactive/i.test(statusRaw) ? 'inactive' : 'active';
    const key = app || roll;
    if (key && seen.has(key)) {
      seen.get(key).duplicate = true;
      continue;
    }
    const student = { application_number: app, roll_number: roll, name, email, status, duplicate: false };
    if (key) seen.set(key, student);
    students.push(student);
  }

  return { ok: true, students, headerIndex, columns };
}

export function studentLabel(s) {
  return s.application_number || s.roll_number || s.id;
}
