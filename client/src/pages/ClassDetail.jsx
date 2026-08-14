import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { STUDENT_STATUS, RECORD_STATUS } from '../db/db.js';
import {
  getStudentsForClass,
  addStudent,
  updateStudent,
  setStudentStatus,
  getSessionsForClass,
} from '../db/repositories.js';
import { useApp } from '../state/AppContext.jsx';
import { BackLink, StatusPill, PageHeader, EmptyState } from '../components/ui.jsx';
import Modal, { Confirm } from '../components/Modal.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { Icons, Icon } from '../components/icons.jsx';
import { DEFAULT_ATTENDANCE_THRESHOLD, clampThreshold, formatDate, getRiskLevel, getStudentAttendancePercentage } from '../lib/utils.js';
import { buildAttendanceMatrixCsv, downloadCsv } from '../lib/attendanceCsv.js';

function StudentForm({ open, onClose, student, classId, onSaved }) {
  const [app, setApp] = useState(student?.application_number || '');
  const [roll, setRoll] = useState(student?.roll_number || '');
  const [name, setName] = useState(student?.name || '');
  const [email, setEmail] = useState(student?.email || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Student name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (student) {
        await updateStudent(student.id, {
          application_number: app,
          roll_number: roll,
          name,
          email,
        });
      } else {
        await addStudent({
          class_id: classId,
          application_number: app,
          roll_number: roll,
          name,
          email,
        });
      }
      onSaved?.(student ? 'edited' : 'added');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={student ? 'Edit Student' : 'Add Student'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="stu-app">
              Application Number
            </label>
            <input id="stu-app" className="input" value={app} onChange={(e) => setApp(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="stu-roll">
              Roll Number
            </label>
            <input id="stu-roll" className="input" value={roll} onChange={(e) => setRoll(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="stu-name">
            Student Name
          </label>
          <input id="stu-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus={!student} />
        </div>
        <div>
          <label className="label" htmlFor="stu-email">
            Email
          </label>
          <input id="stu-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : student ? 'Save Changes' : 'Add Student'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function ClassDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useApp();

  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const allStudents = useLiveQuery(() => getStudentsForClass(id, { includeInactive: true }), [id]);
  const sessions = useLiveQuery(() => getSessionsForClass(id), [id]);
  const attendanceRecords = useLiveQuery(async () => {
    if (!sessions || sessions.length === 0) return {};
    const ids = sessions.map((session) => session.id);
    const records = await db.attendance_records.where('attendance_session_id').anyOf(ids).toArray();
    const map = {};
    for (const record of records) {
      if (!map[record.attendance_session_id]) map[record.attendance_session_id] = [];
      map[record.attendance_session_id].push(record);
    }
    return map;
  }, [sessions]);

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [removing, setRemoving] = useState(null);

  const threshold = useMemo(() => clampThreshold(klass?.attendance_threshold ?? DEFAULT_ATTENDANCE_THRESHOLD), [klass]);
  const activeCount = useMemo(
    () => (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE).length,
    [allStudents]
  );

  const classStats = useMemo(() => {
    const activeStudents = (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE);
    const completedSessions = (sessions || []).filter((session) => session.status === 'completed');

    let lastSession = null;
    let lastSessionDate = null;
    let lastPresent = 0;
    let lastAbsent = 0;

    if (completedSessions.length > 0) {
      lastSession = [...completedSessions].sort((a, b) => b.date.localeCompare(a.date))[0];
      const sessionRecords = attendanceRecords?.[lastSession.id] || [];
      lastPresent = sessionRecords.filter((record) => record.status === RECORD_STATUS.PRESENT).length;
      lastAbsent = sessionRecords.filter((record) => record.status === RECORD_STATUS.ABSENT).length;
      lastSessionDate = lastSession.date;
    }

    const percentages = activeStudents.map((student) => {
      const recordsList = completedSessions
        .map((session) => (attendanceRecords?.[session.id] || []).find((record) => record.student_id === student.id))
        .filter(Boolean);
      const total = recordsList.length;
      const present = recordsList.filter((record) => record.status === RECORD_STATUS.PRESENT).length;
      return {
        student,
        percentage: total ? (present / total) * 100 : 0,
      };
    });

    const average = percentages.length
      ? percentages.reduce((sum, item) => sum + item.percentage, 0) / percentages.length
      : 0;

    const summary = { safe: 0, atRisk: 0, critical: 0 };
    for (const item of percentages) {
      const risk = getRiskLevel(item.percentage, threshold);
      if (risk.label === 'SAFE') summary.safe += 1;
      else if (risk.label === 'AT RISK') summary.atRisk += 1;
      else summary.critical += 1;
    }

    return {
      lastSession,
      lastSessionDate,
      lastPresent,
      lastAbsent,
      average,
      belowThreshold: percentages.filter((item) => item.percentage < threshold).length,
      risk: summary,
      percentages,
    };
  }, [allStudents, sessions, attendanceRecords, threshold]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allStudents || []).filter((s) => {
      if (!showInactive && s.status === STUDENT_STATUS.INACTIVE) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.application_number.toLowerCase().includes(q) ||
        s.roll_number.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    });
  }, [allStudents, search, showInactive]);

  if (!klass) return null;

  const exportClassRoster = () => {
    const rows = [['Application Number', 'Roll Number', 'Student Name', 'Email']];
    for (const student of allStudents || []) {
      if (student.status !== STUDENT_STATUS.ACTIVE) continue;
      rows.push([student.application_number, student.roll_number, student.name, student.email]);
    }
    downloadCsv(`${(klass.class_name || 'class').replace(/\s+/g, '-').toLowerCase()}-roster.csv`, rows.map((row) => row.join(',')).join('\n'));
    pushToast({ type: 'success', title: 'Roster exported', message: 'Downloaded a local CSV file.' });
  };

  const exportAttendanceCsv = () => {
    const data = buildAttendanceMatrixCsv(klass, (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE), sessions || [], attendanceRecords || {});
    downloadCsv(data.filename, data.text);
    pushToast({ type: 'success', title: 'Attendance exported', message: 'Downloaded a local CSV file.' });
  };

  const afterSave = (kind) => {
    pushToast({
      type: 'success',
      title: kind === 'added' ? 'Student added' : 'Student updated',
      message: 'Saved locally on this device.',
    });
  };

  const removeStudent = async (student) => {
    await setStudentStatus(student.id, STUDENT_STATUS.INACTIVE);
    pushToast({
      type: 'info',
      title: 'Student removed',
      message: 'Marked Inactive. Attendance history is preserved.',
    });
  };

  const restoreStudent = async (student) => {
    await setStudentStatus(student.id, STUDENT_STATUS.ACTIVE);
    pushToast({
      type: 'success',
      title: 'Student restored',
      message: 'This student will appear in future attendance sessions.',
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4">
        <BackLink to="/" label="Dashboard" />
      </div>

      <PageHeader
        title={klass.class_name}
        subtitle={
          klass.section ? `${klass.section} · ${activeCount} active student${activeCount === 1 ? '' : 's'}` : `${activeCount} active student${activeCount === 1 ? '' : 's'}`
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => navigate(`/classes/${id}/attendance`)}>
          <Icon d={Icons.clipboard} className="h-4 w-4" /> Take Attendance
        </button>
        <button className="btn-secondary" onClick={() => { setEditingStudent(null); setFormOpen(true); }}>
          <Icon d={Icons.plus} className="h-4 w-4" /> Add Student
        </button>
        <Link to={`/classes/${id}/history`} className="btn-secondary">
          <Icon d={Icons.history} className="h-4 w-4" /> Attendance History
        </Link>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Class Snapshot</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Students</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{activeCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last Attendance</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{classStats.lastSessionDate ? formatDate(new Date(classStats.lastSessionDate.split('-').join('/'))) : '—'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Last Session</p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                {classStats.lastSession ? `${classStats.lastPresent} Present · ${classStats.lastAbsent} Absent` : '—'}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Average Attendance</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{classStats.average.toFixed(1)}%</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Below {threshold}%</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{classStats.belowThreshold}</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" onClick={() => navigate(`/classes/${id}/attendance`)}>
              <Icon d={Icons.clipboard} className="h-4 w-4" /> Take Attendance
            </button>
          </div>
        </div>

        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Attendance Risk</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              <span>✓ Safe</span>
              <span className="font-black">{classStats.risk.safe}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <span>⚠ At Risk</span>
              <span className="font-black">{classStats.risk.atRisk}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
              <span>● Critical</span>
              <span className="font-black">{classStats.risk.critical}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 card p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Student Risk</p>
          <span className="text-xs text-slate-500">Threshold: {threshold}%</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {(allStudents || []).filter((student) => student.status === STUDENT_STATUS.ACTIVE).map((student) => {
            const pct = classStats.percentages.find((item) => item.student.id === student.id)?.percentage ?? 0;
            const risk = getRiskLevel(pct, threshold);
            const tone = risk.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : risk.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';
            return (
              <div key={student.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{student.name}</p>
                  <p className="text-xs text-slate-500">{student.application_number} · {student.roll_number || '—'}</p>
                </div>
                <div className="text-right">
                  <p className="font-black text-slate-900">{pct.toFixed(0)}%</p>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone}`}>
                    {risk.icon} {risk.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button className="btn-secondary" onClick={exportClassRoster}>
          <Icon d={Icons.download} className="h-4 w-4" /> Export Student Roster
        </button>
        <button className="btn-secondary" onClick={exportAttendanceCsv}>
          <Icon d={Icons.download} className="h-4 w-4" /> Export Attendance CSV
        </button>
      </div>

      <div className="card mb-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
            <Icon d={Icons.users} className="h-4 w-4" />
          </span>
          <input
            className="input pl-9"
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Show inactive
        </label>
      </div>

      {filtered.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Application Number</th>
                  <th className="px-4 py-3">Roll Number</th>
                  <th className="px-4 py-3">Student Name</th>
                  <th className="hidden px-4 py-3 md:table-cell">Email</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.id} className={`hover:bg-slate-50/60 ${s.status === STUDENT_STATUS.INACTIVE ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.application_number}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{s.roll_number}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                          {s.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{s.name}</p>
                          <p className="truncate text-xs text-slate-400 md:hidden">{s.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">{s.email}</td>
                    <td className="px-4 py-3">
                      <StatusPill status={s.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end">
                        <Dropdown
                          align="right"
                          items={[
                            { label: 'Edit', icon: Icons.pencil, onClick: () => { setEditingStudent(s); setFormOpen(true); } },
                            { label: 'View Attendance', icon: Icons.history, onClick: () => navigate(`/classes/${id}/students/${s.id}`) },
                            { divider: true },
                            s.status === STUDENT_STATUS.ACTIVE
                              ? { label: 'Remove', icon: Icons.trash, danger: true, onClick: () => setRemoving(s) }
                              : { label: 'Restore', icon: Icons.check, onClick: () => restoreStudent(s) },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={Icons.users}
          title={search ? 'No students match your search' : 'No students yet'}
          message={
            search
              ? 'Try a different search or show inactive students.'
              : 'Add your first student or import from a CSV.'
          }
          action={
            !search && (
              <button className="btn-primary" onClick={() => { setEditingStudent(null); setFormOpen(true); }}>
                <Icon d={Icons.plus} className="h-4 w-4" /> Add Student
              </button>
            )
          }
        />
      )}

      <StudentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editingStudent}
        classId={id}
        onSaved={afterSave}
      />

      <Confirm
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => removeStudent(removing)}
        title="Remove student?"
        message={`"${removing?.name}" will no longer appear during future attendance sessions. Previous attendance records will be preserved.`}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
