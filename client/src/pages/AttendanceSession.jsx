import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import {
  getStudentsForClass,
  getInProgressSession,
  createSession,
  upsertRecord,
  getRecordMap,
  deleteRecordByStudent,
  hasCompletedSessionOnDate,
} from '../db/repositories.js';
import { toDateKey, formatDateLabel } from '../lib/utils.js';
import { useApp } from '../state/AppContext.jsx';
import Modal from '../components/Modal.jsx';
import { BackLink, EmptyState } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

function CountPill({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-center">
      <p className={`text-lg font-bold ${tone}`}>{value}</p>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export default function AttendanceSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { pushToast } = useApp();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);

  const students = useLiveQuery(() => getStudentsForClass(id, { includeInactive: false }), [id]);
  const session = useLiveQuery(() => getInProgressSession(id), [id]);
  const records = useLiveQuery(async () => (session ? getRecordMap(session.id) : {}), [session?.id]);
  const duplicateToday = useLiveQuery(async () => hasCompletedSessionOnDate(id, toDateKey(new Date())), [id]);

  const [index, setIndex] = useState(0);
  const [initialized, setInitialized] = useState(false);
  const [replaceWarn, setReplaceWarn] = useState(false);
  const lastMark = useRef(0);
  const creating = useRef(false);

  useEffect(() => {
    if (session || creating.current) return;
    creating.current = true;
    createSession(id)
      .catch((err) => pushToast({ type: 'error', title: 'Could not start session', message: err.message }))
      .finally(() => {
        creating.current = false;
      });
  }, [session, id, pushToast]);

  useEffect(() => {
    if (!students || !records || initialized) return;
    const firstUnmarked = students.findIndex((s) => !records[s.id]);
    setIndex(firstUnmarked === -1 ? 0 : firstUnmarked);
    setInitialized(true);
  }, [students, records, initialized]);

  useEffect(() => {
    if (!duplicateToday || !session) return;
    setReplaceWarn(true);
  }, [duplicateToday, session]);

  const markedCount = useMemo(() => (records ? Object.keys(records).length : 0), [records]);
  const presentCount = useMemo(
    () => (records ? Object.values(records).filter((r) => r.status === RECORD_STATUS.PRESENT).length : 0),
    [records]
  );
  const absentCount = markedCount - presentCount;
  const total = students?.length || 0;
  const remaining = Math.max(0, total - markedCount);

  const current = students?.[index];

  const progressPct = total ? Math.round((markedCount / total) * 100) : 0;

  const mark = async (status) => {
    if (!students || !session || !current) return;
    const now = Date.now();
    if (now - lastMark.current < 250) return;
    lastMark.current = now;
    await upsertRecord(session.id, current.id, status);
    setIndex((i) => i + 1);
  };

  const goPrevious = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const undoLast = async () => {
    if (index === 0) return;
    const prev = students[index - 1];
    if (!prev || !session) return;
    await deleteRecordByStudent(session.id, prev.id);
    setIndex((i) => i - 1);
  };

  const startNew = async () => {
    setReplaceWarn(false);
    setInitialized(false);
    await createSession(id);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        mark(RECORD_STATUS.PRESENT);
      } else if (e.key === 'ArrowLeft' || e.key === ' ') {
        e.preventDefault();
        mark(RECORD_STATUS.ABSENT);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        undoLast();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        goPrevious();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!students || !session || !records) return null;

  if (students.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <BackLink to="/" label="Dashboard" />
        <div className="mt-6">
          <EmptyState
            icon={Icons.users}
            title="No active students"
            message="Add students to this class before taking attendance."
            action={
              <button className="btn-primary" onClick={() => navigate(`/classes/${id}`)}>
                <Icon d={Icons.plus} className="h-4 w-4" /> Manage Students
              </button>
            }
          />
        </div>
      </div>
    );
  }

  if (markedCount >= total && total > 0) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-100 px-4">
        <div className="card fade-in w-full max-w-md p-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
            <Icon d={Icons.checkCircle} className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Attendance complete</h1>
          <p className="mt-2 text-sm text-slate-600">
            All {total} students have been marked. Review the list and submit to save it locally.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
              <p className="text-xl font-black text-emerald-700">{presentCount}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Present</p>
            </div>
            <div className="rounded-xl bg-rose-50 px-3 py-2.5">
              <p className="text-xl font-black text-rose-700">{absentCount}</p>
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Absent</p>
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-2">
            <button className="btn-primary py-3 text-base" onClick={() => navigate(`/classes/${id}/review/${session.id}`)}>
              Review Attendance
            </button>
            <button className="btn-ghost" onClick={() => navigate(`/classes/${id}`)}>
              Back to Class
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col bg-slate-100">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <BackLink to="/" label="Exit" />
          <div className="text-right">
            <p className="text-sm font-bold text-slate-900">{session?.date ? formatDateLabel(session.date) : ''}</p>
            <p className="text-xs text-slate-500">
              {markedCount} / {total} marked
            </p>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
          <span className="truncate">
            {klass?.class_name}
            {klass?.section ? ` · ${klass.section}` : ''}
          </span>
          <span>{index + 1} / {total}</span>
        </div>
        <div className="mb-6 h-3 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="card flex flex-1 flex-col justify-between p-6 sm:p-10">
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Application Number
            </p>
            <p className="mt-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
              {current?.application_number || '—'}
            </p>
          </div>

          <div className="my-8 text-center">
            <h1 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-6xl">
              {current?.name}
            </h1>
            <p className="mt-3 text-lg font-semibold text-slate-500">Roll No: {current?.roll_number || '—'}</p>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-3">
            <CountPill label="Present" value={presentCount} tone="text-emerald-600" />
            <CountPill label="Absent" value={absentCount} tone="text-rose-600" />
            <CountPill label="Remaining" value={remaining} tone="text-slate-700" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.ABSENT); }}
              className="btn-danger rounded-2xl py-5 text-2xl font-bold"
            >
              Absent
            </button>
            <button
              onClick={(e) => { e.currentTarget.blur(); mark(RECORD_STATUS.PRESENT); }}
              className="btn rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white hover:bg-emerald-700 active:bg-emerald-800"
            >
              Next ✓
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            Next = Present · Keyboard: →/Enter present, ←/Space absent, Backspace undo
          </p>

          <div className="mt-4 flex justify-center gap-3">
            <button className="btn-secondary px-6" onClick={goPrevious} disabled={index === 0}>
              <Icon d={Icons.arrowLeft} className="h-4 w-4" /> Previous
            </button>
            <button className="btn-secondary px-6" onClick={undoLast} disabled={index === 0}>
              <Icon d={Icons.undo} className="h-4 w-4" /> Undo
            </button>
          </div>
        </div>
      </div>

      <Modal open={replaceWarn} onClose={() => setReplaceWarn(false)} title="Attendance for today already exists" size="sm">
        <p className="text-sm leading-6 text-slate-600">
          Today's attendance was already submitted. You can start a new session anyway — only today's records will be
          affected and previous dates will not be touched. Or cancel and edit the existing session from Attendance
          History.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setReplaceWarn(false)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={startNew}>
            Start New Session
          </button>
        </div>
      </Modal>
    </div>
  );
}
