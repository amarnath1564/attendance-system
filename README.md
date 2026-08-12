# AttendIt — Teacher Attendance System

A local-first, offline-friendly attendance management web app for teachers. On first launch you set up a simple teacher profile (onboarding); from there you can manage classes, import students, and take attendance — all stored privately in your browser.

## Features

- **Onboarding** — create a teacher profile on first use; everything lives on this device.
- **Classes & students** — create/edit/delete classes, add students manually, or import a roster from CSV.
- **Attendance sessions** — fast present/absent flow with keyboard shortcuts, progress tracking, review and submission, and an unfinished-session reminder on the dashboard.
- **History** — attendance history per class and per student, with per-session detail views.
- **Backup & restore** — export/import your full local data as a JSON file.
- **PWA** — installable on desktop/mobile, works offline once loaded.

## Tech stack

- [React](https://react.dev) 18 + [Vite](https://vitejs.dev) 5
- [react-router-dom](https://reactrouter.com) for routing
- [Dexie](https://dexie.org) (IndexedDB) with `dexie-react-hooks` for reactive queries
- [Tailwind CSS](https://tailwindcss.com) 3
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) for the installable PWA

## Getting started

```bash
cd client
npm install
npm run dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

### Production build

```bash
npm run build     # outputs to client/dist
npm run preview   # serve the production build locally
```

## Using the app

1. **Onboarding** — enter your teacher name (email optional) to create your profile.
2. **Add a class** — Dashboard → *Add Class*.
3. **Import students** — upload a CSV or use the sample generator. The CSV should have columns `Application Number`, `Roll Number`, `Student Name`; `Email` and `Status` are optional.
4. **Take attendance** — open a class → *Take Attendance*. Mark Present/Absent with the buttons or keyboard:

   | Key | Action |
   | --- | --- |
   | `→` / `Enter` | Present |
   | `←` / `Space` | Absent |
   | `Backspace` | Undo last mark |
   | `↑` | Go to previous student |

5. **Review & submit** — toggle any marks, then *Submit Attendance* to save it locally.
6. **History** — view class-level history and per-student records.

## Data & privacy

- All data (teacher profile, classes, students, attendance) is stored in **IndexedDB in your browser only**.
- No account, no login, and no cloud — nothing is sent to any server.
- Use *Settings → Export Local Data* to back up, and *Import Local Data* to restore on another device or browser.
- Clearing browser data for the site removes everything (export a backup first if you want to keep it).

## Project structure

```
attendance-system/
└── client/
    ├── public/                 # PWA icons & manifest assets
    ├── scripts/                # dev/probe scripts
    └── src/
        ├── components/         # Layout, Modal, Toasts, UI primitives, icons
        ├── db/                 # Dexie schema (db.js) and data access (repositories.js)
        ├── hooks/              # (reserved) shared hooks
        ├── lib/                # CSV parsing, sample data, backup utilities
        ├── pages/              # Onboarding, Dashboard, ClassSetup, ClassDetail,
        │                       # AttendanceSession, AttendanceReview, History pages, Settings
        ├── state/              # AppContext (teacher, online, toasts)
        ├── App.jsx             # routing + onboarding gate
        └── main.jsx            # entry point
```
