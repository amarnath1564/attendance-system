import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { RECORD_STATUS } from '../db/db.js';
import { getSession, getRecordMap, getStudentsForClass } from '../db/repositories.js';
import { formatDate, fromDateKey } from '../lib/utils.js';
import { BackLink, EmptyState, PageHeader } from '../components/ui.jsx';
import { Icons, Icon } from '../components/icons.jsx';

export default function SessionDetail() {
  const { id, sessionId } = useParams();
  const klass = useLiveQuery(() => db.classes.get(id), [id]);
  const session = useLiveQuery(() => getSession(sessionId), [sessionId]);
  const students = useLiveQuery(() => getStudentsForClass(id, { includeInactive: true }), [id]);
  const records = useLiveQuery(async () => (session ? getRecordMap(session.id) : {}), [session?.id]);

  const list = useMemo(() => {
    if (!students || !records) return [];
    return students.map((s) => ({ student: s, status: records[s.id]?.status }));
  }, [students, records]);

  const present = list.filter((x) => x.status === RECORD_STATUS.PRESENT).length;
  const absent = list.filter((x) => x.status === RECORD_STATUS.ABSENT).length;
  const pct = present + absent ? ((present / (present + absent)) * 100).toFixed(1) : '0.0';

  if (!klass || !session) return null;

  const date = fromDateKey(session.date);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <BackLink to={`/classes/${id}/history`} label="Attendance History" />
      <div className="mt-4">
        <PageHeader
          title={formatDate(date)}
          subtitle={`${klass.class_name}${klass.section ? ` · ${klass.section}` : ''}`}
        />
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-emerald-600">{present}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Present</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-rose-600">{absent}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Absent</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-black text-slate-900">{pct}%</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Attendance</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Application Number</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map(({ student, status }) => (
                <tr key={student.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{student.application_number}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{student.name}</td>
                  <td className="px-4 py-2.5 text-right">
                    {status === RECORD_STATUS.PRESENT ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        <Icon d={Icons.check} className="h-3.5 w-3.5" /> Present
                      </span>
                    ) : status === RECORD_STATUS.ABSENT ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700">
                        <Icon d={Icons.x} className="h-3.5 w-3.5" /> Absent
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                        Not marked
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {list.length === 0 && (
        <EmptyState icon={Icons.history} title="No records in this session" message="This session has no attendance records." />
      )}

      <div className="mt-6">
        <Link to={`/classes/${id}`} className="btn-secondary">
          <Icon d={Icons.arrowLeft} className="h-4 w-4" /> Back to Class
        </Link>
      </div>
    </div>
  );
}
