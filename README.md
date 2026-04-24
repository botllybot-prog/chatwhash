# Car Wash Booking Bot — System Documentation

Omnichannel car wash booking platform with WhatsApp bot (Meta Cloud API), Supabase backend, and React admin dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Shadcn/UI |
| Backend | Supabase Edge Functions (Deno 2) |
| Database | PostgreSQL via Supabase |
| WhatsApp | Meta Cloud API (interactive messages) |
| Hosting | Netlify (frontend) + Supabase (functions) |
| Bot scheduling | Supabase Cron + `booking-reminders` function |

---

## Project Structure

```
src/
  components/bot-admin/   # Admin UI components (Employees, Owners, Stations…)
  pages/
    admin/                # Admin pages
    employee/             # Employee portal
supabase/functions/
  whatsapp-webhook/       # Main bot logic — v33
  booking-reminders/      # Cron: timeout alerts & reminders — v3
  create-employee/        # Employee account creation — v3
  delete-employee/        # Employee account deletion — v2
  create-station-owner/   # Owner account creation — v2
  whatsapp-send/          # WhatsApp message dispatch helper — v3
scripts/
  deploy-fns.cjs          # Deploy edge functions
  setup-hooks.cjs         # Configure git hooks (run once after clone)
  migrate*.cjs            # DB migration scripts
.githooks/
  prepare-commit-msg      # Auto-prepends [YYYY-MM-DD] to every commit
  pre-push                # Warns if CHANGELOG.md wasn't updated
```

---

## Getting Started

```bash
git clone https://github.com/botllybot-prog/chatwhash
cd chatwhash
npm install          # also runs: node scripts/setup-hooks.cjs (activates git hooks)
npm run dev
```

> After cloning on a new machine, run `node scripts/setup-hooks.cjs` manually if `postinstall` was skipped.

---

## Git Workflow Rules (Enforced)

1. **Every commit gets a date prefix** automatically via `.githooks/prepare-commit-msg`.  
   Commit message `"fix: typo"` becomes `"[2026-04-16] fix: typo"`.

2. **Every push must include a CHANGELOG.md update** — enforced by `.githooks/pre-push`.  
   If you push code without updating the changelog, you receive a warning.

3. **CHANGELOG.md format:**
   ```
   ## [YYYY-MM-DD] — Feature/Fix title
   ### Section (Database / Backend / Frontend)
   - Bullet description
   ```

See [CHANGELOG.md](./CHANGELOG.md) for full history.

---

## Key Features

### WhatsApp Bot (`whatsapp-webhook`)
- Three-tier routing: Customer → Station Owner → Admin
- Booking flow: station selection → service → scheduling → pending approval
- Owner approval/rejection/reschedule with interactive buttons
- Google Maps link sent after confirmation
- Nearest station search with 15 km radius
- Iraqi phone format normalization (`9647xxxxxxxxx`)

### Anti-Spam & Conflict Resolution (Concept 1)
- Blocks duplicate pending bookings per customer
- Smart reschedule: jumps directly to time/day picker for same station+service

### Timeout Alerts & Competitive Routing (Concept 2)
- After 10 min with no owner response, customer gets choice: wait or find another station
- When any owner confirms, all competing pending bookings are auto-cancelled; losing owners are notified

### Granular Employee Permissions (Concept 3)
- 4 permission flags: `can_create_owners`, `can_create_stations`, `can_add_service`, `can_edit_prices`
- All enforced server-side; dashboard buttons hidden if permission missing

### Admin Dashboard
- Station owners CRUD, bulk WhatsApp broadcast
- Employee management with permission toggles + Excel export
- Real-time notification bell
- Booking analytics (daily/weekly/monthly)

---

## Environment Variables

```env
SUPABASE_URL=https://yhklvtzonvgzkodysawu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
WHATSAPP_TOKEN=...
WHATSAPP_PHONE_ID=...
VERIFY_TOKEN=...
ADMIN_PHONE=...
```

---

## Deployment

```bash
# Deploy a specific edge function
node scripts/deploy-fns.cjs whatsapp-webhook

# Deploy frontend
npx netlify-cli deploy --prod --dir=dist
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full dated history of all changes.

