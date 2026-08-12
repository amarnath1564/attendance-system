import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTeacher } from '../db/repositories.js';
import { useApp } from '../state/AppContext.jsx';
import { Icons, Icon } from '../components/icons.jsx';

export default function Onboarding() {
  const { pushToast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await createTeacher({ name, email });
      pushToast({ type: 'success', title: 'Profile created', message: `Welcome, ${name.trim()}!` });
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 via-white to-white px-4 py-12">
      <div className="fade-in w-full max-w-md">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
            <Icon d={Icons.clipboard} className="h-7 w-7" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome</h1>
          <p className="mt-2 text-sm text-slate-600">
            Set up your teacher profile. Everything is stored privately on this device.
          </p>
        </div>

        <form onSubmit={submit} className="card p-6 sm:p-8">
          <div className="mb-4">
            <label className="label" htmlFor="t-name">
              Teacher Name
            </label>
            <input
              id="t-name"
              className="input"
              placeholder="Professor Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="mb-2">
            <label className="label" htmlFor="t-email">
              Email <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="t-email"
              className="input"
              type="email"
              placeholder="you@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
          <button className="btn-primary mt-6 w-full py-3 text-base" disabled={saving}>
            {saving ? 'Creating…' : 'Create Profile'}
          </button>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-500">
            <Icon d={Icons.lock} className="h-3.5 w-3.5" />
            No account, no cloud — this profile lives only in your browser.
          </p>
        </form>
      </div>
    </div>
  );
}
