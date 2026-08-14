const normalize = (v) =>
  String(v || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');

export function matchHeader(header) {
  const h = normalize(header);
  if (/application|admission|app ?no|app ?id|adm ?no/.test(h)) return 'application_number';
  if (/^roll$|roll ?no|roll ?number/.test(h)) return 'roll_number';
  if (/full ?name|student ?name|name$|student/.test(h)) return 'name';
  if (/email|mail/.test(h)) return 'email';
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

function buildHeaders(rows, headerIndex) {
  const headers = Array.isArray(rows[headerIndex]) ? rows[headerIndex] : [];
  const columns = {};
  headers.forEach((h, idx) => {
    const key = matchHeader(h);
    if (key && !(key in columns)) columns[key] = idx;
  });
  return { headers, columns };
}

export function parseStudentRows(rows, manualColumns = null) {
  const headerIndex = findHeaderRow(rows);
  if (headerIndex === -1) {
    return {
      ok: false,
      error:
        'Could not find a valid header row. Required columns: Application Number, Roll Number, Student Name. Email and Status are optional.',
      missingColumns: REQUIRED,
      students: [],
      summary: { rowsFound: rows.length, valid: 0, duplicates: 0, invalid: 0 },
    };
  }

  const { headers, columns: detectedColumns } = buildHeaders(rows, headerIndex);
  const columns = manualColumns && typeof manualColumns === 'object' ? { ...detectedColumns, ...manualColumns } : detectedColumns;

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
      summary: { rowsFound: rows.length, valid: 0, duplicates: 0, invalid: 0 },
    };
  }

  const students = [];
  const valid = [];
  const seenApp = new Map();
  const seenRoll = new Map();
  const duplicates = [];
  const invalid = [];

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row.some((c) => String(c).trim() !== '')) continue;

    const app = (row[columns.application_number] ?? '').toString().trim();
    const roll = (row[columns.roll_number] ?? '').toString().trim();
    const name = (row[columns.name] ?? '').toString().trim();
    const email = columns.email != null ? (row[columns.email] ?? '').toString().trim() : '';
    const statusRaw = columns.status != null ? (row[columns.status] ?? '').toString().trim() : '';

    let reason = '';
    if (!name) reason = 'Missing student name';
    else if (!app) reason = 'Missing application number';

    if (reason) {
      invalid.push({ row: i + 1, reason, app, roll, name });
      continue;
    }

    const duplicateKey = app || roll;
    if (duplicateKey && (seenApp.has(app) || seenRoll.has(roll))) {
      duplicates.push({ row: i + 1, app, roll, name });
      continue;
    }

    const status = /inactive/i.test(statusRaw) ? 'inactive' : 'active';
    const student = { application_number: app, roll_number: roll, name, email, status, duplicate: false };
    valid.push(student);
    if (app) seenApp.set(app, student);
    if (roll) seenRoll.set(roll, student);
  }

  for (const item of valid) {
    students.push(item);
  }

  return {
    ok: true,
    students,
    headerIndex,
    columns,
    headers,
    summary: {
      rowsFound: rows.filter((row) => row.some((cell) => String(cell ?? '').trim() !== '')).length,
      valid: valid.length,
      duplicates: duplicates.length,
      invalid: invalid.length,
      issues: { duplicates, invalid },
    },
  };
}

export function studentLabel(s) {
  return s.application_number || s.roll_number || s.id;
}
