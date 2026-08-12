import { useParams, Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import { getSessionsForClass } from '../db/repositories.js';
import { fromDateKey, formatDate } from '../lib/utils.js';
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

  if (!klass) return null;

  const rows = (sessions || []).map((s) => {
    const recs = allRecords?.[s.id] || [];
    return {
      session: s,
      counts: {
        total: recs.length,
        present: recs.filter((r) => r.status === RECORD_STATUS.PRESENT).length,
      },
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4">
        <BackLink to={`/classes/${id}`} label="Back to class" />
      </div>
      <PageHeader title="Attendance History" subtitle={klass.class_name} />

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map(({ session, counts }) => (
            <SessionRow key={session.id} session={session} klass={klass} counts={counts} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Icons.history}
          title="No attendance recorded yet"
          message="Attendance you submit will appear here, stored locally on this device."
          action={
            <Link to={`/classes/${id}/attendance`} className="btn-primary">
              <Icon d={Icons.clipboard} className="h-4 w-4" /> Take Attendance
            </Link>
          }
        />
      )}
    </div>
  );
}
