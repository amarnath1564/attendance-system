import { useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { STUDENT_STATUS } from '../db/db.js';
import {
  getStudentsForClass,
  addStudent,
  updateStudent,
  setStudentStatus,
} from '../db/repositories.js';
import { useApp } from '../state/AppContext.jsx';
import { BackLink, StatusPill, PageHeader, EmptyState } from '../components/ui.jsx';
import Modal, { Confirm } from '../components/Modal.jsx';
import Dropdown from '../components/Dropdown.jsx';
import { Icons, Icon } from '../components/icons.jsx';

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

  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [removing, setRemoving] = useState(null);

  const activeCount = useMemo(
    () => (allStudents || []).filter((s) => s.status === STUDENT_STATUS.ACTIVE).length,
    [allStudents]
  );

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
