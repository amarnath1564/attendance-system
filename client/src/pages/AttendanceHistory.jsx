import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import { getSessionsForClass } from '../db/repositories.js';
import { fromDateKey, formatDate, getMonthGrid } from '../lib/utils.js';
import { BackLink, EmptyState, PageHeader } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

function SessionRow({ session, klass, counts }) {
  const navigate = useNavigate();
  const pct = counts.total ? ((counts.present / counts.total) * 100).toFixed(1) : '0.0';
  const day = fromDateKey(session.date);
  return (
    <button
      onClick={() => navigate(`/classes/${klass.id}/history/${session.id}`)}
      className="card flex w-full items-center gap-4 p-4 text-left transition hover:shadow-lift"
    >
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <span className="text-lg font-black leading-none">{day.getDate()}</span>
        <span className="text-[10px] font-bold uppercase">
          {day.toLocaleDateString('en-US', { month: 'short' })}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-slate-900">{formatDate(day)}</p>
        <p className="text-sm text-slate-500">
          {counts.present} / {counts.total} present
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${
            Number(pct) >= 75 ? 'bg-emerald-50 text-emerald-700' : Number(pct) >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {pct}%
        </span>
        <Icon d={Icons.arrowLeft} className="h-4 w-4 rotate-180 text-slate-400" />
      </div>
    </button>
  );
}

export default function AttendanceHistory() {
  const { id } = useParams();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const sessions = useLiveQuery(() => getSessionsForClass(id), [id]);
  const rosterTotal = useLiveQuery(
    async () => db.students.where('class_id').equals(id).filter((s) => s.status === 'active').count(),
    [id]
  );
  const [month, setMonth] = useState(new Date());
  const allRecords = useLiveQuery(
    async () => {
      if (!sessions || sessions.length === 0) return {};
      const ids = sessions.map((s) => s.id);
      const recs = await db.attendance_records.where('attendance_session_id').anyOf(ids).toArray();
      const map = {};
      for (const r of recs) {
        if (!map[r.attendance_session_id]) map[r.attendance_session_id] = [];
        map[r.attendance_session_id].push(r);
      }
      return map;
    },
    [sessions?.length]
  );

  const rows = useMemo(() => {
    const total = rosterTotal ?? null;
    return (sessions || []).map((s) => {
      const recs = allRecords?.[s.id] || [];
      return {
        session: s,
        counts: {
          total: total ?? recs.length,
          present: recs.filter((r) => r.status === RECORD_STATUS.PRESENT).length,
          absent: recs.filter((r) => r.status === RECORD_STATUS.ABSENT).length,
        },
      };
    });
  }, [sessions, allRecords, rosterTotal]);

  const sessionByDate = useMemo(() => {
    const map = {};
    for (const row of rows) {
      map[row.session.date] = row;
    }
    return map;
  }, [rows]);

  const monthGrid = useMemo(() => getMonthGrid(month), [month]);
  const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(month);

  if (!klass) return null;

  const selectedDate = rows.length ? rows[rows.length - 1].session.date : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <BackLink to={`/classes/${id}`} label="Back to class" />
      </div>
      <PageHeader title="Attendance History" subtitle={klass.class_name} />

      {rows.length > 0 ? (
        <>
          <div className="card mb-6 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                  Previous Month
                </button>
                <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setMonth(new Date())}>Today</button>
                <button className="btn-secondary px-3 py-2 text-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                  Next Month
                </button>
              </div>
              <div className="text-right">
                <p className="text-lg font-black text-slate-900">{monthLabel}</p>
                <p className="text-xs text-slate-500">Local attendance records</p>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {monthGrid.cells.map((date) => {
                const key = date.toISOString().slice(0, 10);
                const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const hasSession = !!sessionByDate[dayKey];
                const isCurrentMonth = date.getMonth() === month.getMonth();
                const isToday = key === new Date().toISOString().slice(0, 10);
                const session = sessionByDate[dayKey]?.session;
                const counts = sessionByDate[dayKey]?.counts || { present: 0, absent: 0 };
                return (
                  <button
                    key={`${dayKey}-cell`}
                    onClick={() => session && navigate(`/classes/${id}/history/${session.id}`)}
                    disabled={!session}
                    className={[
                      'relative flex min-h-[84px] flex-col rounded-xl border p-1.5 text-left transition',
                      isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 text-slate-400',
                      isToday ? 'ring-2 ring-brand-300' : '',
                      hasSession ? 'border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50' : 'hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span className="text-xs font-bold">{date.getDate()}</span>
                    {hasSession ? (
                      <div className="mt-auto">
                        <div className="flex items-center justify-between text-[10px] font-bold text-emerald-700">
                          <span>{counts.present}</span>
                          <span>✓</span>
                        </div>
                        <div className="text-[10px] text-slate-500">{counts.absent} absent</div>
                        {counts.total > counts.present + counts.absent && (
                          <div className="text-[10px] text-slate-400">{counts.total - counts.present - counts.absent} not marked</div>
                        )}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && sessionByDate[selectedDate] && (
            <div className="card mb-6 p-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">Selected Date</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xl font-black text-slate-900">{formatDate(fromDateKey(selectedDate))}</p>
                  <p className="text-sm text-slate-500">{sessionByDate[selectedDate].counts.present} / {sessionByDate[selectedDate].counts.total} present</p>
                </div>
                <button className="btn-primary" onClick={() => navigate(`/classes/${id}/history/${sessionByDate[selectedDate].session.id}`)}>
                  Open Session
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {rows.map(({ session, counts }) => (
              <SessionRow key={session.id} session={session} klass={klass} counts={counts} />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          icon={Icons.history}
          title="No attendance recorded yet"
          message="Attendance you submit will appear here, stored locally on this device."
        />
      )}
    </div>
  );
}
