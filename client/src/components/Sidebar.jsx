import { NavLink, Link } from 'react-router-dom';
import { Icons, Icon } from './icons.jsx';

export default function Sidebar() {
  const links = [
    { to: '/', icon: Icons.home, label: 'Dashboard' },
    { to: '/history', icon: Icons.history, label: 'Attendance History' },
  ];

  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-0 border-b border-slate-200 bg-white p-4">
        <Link to="/" className="flex items-center gap-2.5" data-tour="tour-logo">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Icon d={Icons.clipboard} className="h-5 w-5" />
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Attend<span className="text-brand-600">It</span>
          </span>
        </Link>
      </div>
      <nav className="sticky top-16 flex flex-col gap-1 p-4">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/'}
            data-tour={link.to === '/history' ? 'tour-history' : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`
            }
          >
            <Icon d={link.icon} className="h-5 w-5" />
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
