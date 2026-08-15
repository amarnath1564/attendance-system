import { Link, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../state/AppContext.jsx';
import { Icons, Icon } from './icons.jsx';
import Sidebar from './Sidebar.jsx';
import InstallApp from './InstallApp.jsx';

export default function Layout() {
  const { teacher, online, theme, toggleTheme } = useApp();

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden lg:flex-row">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <Icon d={Icons.clipboard} className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Attend<span className="text-brand-600">It</span>
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${
                  online
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                {online ? 'Online' : 'Offline'}
              </span>
              <InstallApp variant="header" />
              <button
                onClick={toggleTheme}
                className="inline-flex items-center justify-center rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                <Icon d={theme === 'dark' ? Icons.sun : Icons.moon} className="h-5 w-5" />
              </button>
              <NavLink
                to="/settings"
                className={({ isActive }) =>
                  `inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                  }`
                }
              >
                <Icon d={Icons.settings} className="h-4.5 w-4.5" />
                <span className="hidden sm:inline">Settings</span>
              </NavLink>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-white dark:bg-slate-900">
          <Outlet />
        </main>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-white py-2 dark:border-slate-700 dark:bg-slate-900">
          <div className="mx-auto flex max-w-6xl items-center justify-center gap-1 px-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
            <Icon d={Icons.lock} className="h-3 w-3" />
            Your application data is stored locally on this device. Signed in locally as {teacher?.name || 'demo'}.
          </div>
        </footer>
      </div>
    </div>
  );
}
