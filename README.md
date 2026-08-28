# ETS Integrated Project Management — Demo

A clean project/task tracking demo built from scratch from the supplied FRD and ETS tracker data.

## Run

```powershell
npm run dev
```

Open: http://localhost:5173

## Demo features
- Sidebar navigation: Overview, Projects, My Tasks, Capacity, Reports
- Project portfolio + Kanban task board
- Right-side task detail/edit pane
- Role switcher for Senior Management / LTSE / TSE-JTSE
- Server-side field masking for commercial data
- TSE/JTSE engineering field masking on Commercial RFQ cards
- LTSE+ task assignment permissions
- Internal EER creation and stakeholder notification behavior
- MH estimate vs actual tracking and escalation/bottleneck reasons
- Notifications and audit trail
- Capacity planning heatmap
- Management-only reporting and CSV export
- JSON persistence for demo changes; Reset Demo restores seed data

## Demo architecture
- Frontend: vanilla HTML/CSS/JS
- API: Node.js built-in HTTP server (zero dependencies)
- Persistence: JSON file (`data/db.json`) for zero-setup local demo
- Seed: converted from the supplied ETS tracking CSV, plus one Internal EER scenario for demonstrating FRD workflows

This is a demo architecture. For production, replace JSON storage and role simulation with a relational database, authenticated users, and formal RBAC/authorization middleware.

## Demo login

- User: `Stephan`
- User ID: `123`
- Password: `Testing`

Authentication uses an HttpOnly session cookie held by the Node server. Demo credential values can later be supplied through `DEMO_USER`, `DEMO_ID`, and `DEMO_PASSWORD` environment variables, or the auth layer can be replaced with database/SSO authentication without changing the project/task API structure.
