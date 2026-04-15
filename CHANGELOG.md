# CHANGELOG — Car Wash Booking Bot

All notable changes to this project are documented here.  
Format: `## [YYYY-MM-DD] — Title`

---

## [2026-04-16] — Concept 3: Granular Employee Permissions

### Database
- `employees` table: added `can_add_service BOOLEAN DEFAULT false`
- `employees` table: added `can_edit_prices BOOLEAN DEFAULT false`

### Backend (`create-employee` v3)
- Accepts `can_add_service` and `can_edit_prices` in request body and persists them

### Frontend
- **EmployeesTab**: displays 4 permission badges; create/edit dialogs include new toggles
- **EmployeeDashboard**: shows "إضافة خدمة" and "تعديل سعر" buttons only when permitted; server-side guard rejects unauthorized API calls with "عذراً، لا تملك صلاحية لهذه العملية."

---

## [2026-04-16] — Concept 2: Timeout Alerts & Competitive Routing

### Database
- `bookings` table: added `timeout_notified BOOLEAN DEFAULT false`
- `bot_sessions` table: added `timeout_booking_id UUID`
- `bot_sessions` table: added `conflict_booking_id UUID`

### Backend (`booking-reminders` v3)
- Every cron run checks for `pending` bookings older than 10 minutes with `timeout_notified = false`
- Sends customer interactive WhatsApp message: "مغسلة X تأخرت في الرد. هل تود الانتظار أم البحث عن مغسلة أخرى؟"
- Buttons: `⏳ الانتظار` | `🔍 البحث عن مغسلة أخرى`
- Sets `timeout_notified = true` and customer session to `timeout_alert` step

### Backend (`whatsapp-webhook` v33)
- New step `timeout_alert`: handles customer response
  - `timeout_wait` → restores `awaiting_owner_response` state
  - `timeout_search` → cancels booking, returns to main menu
- **Competitive punishment** in `confirmBookingAndNotifyCustomer`: when owner B confirms, all other `pending` bookings for that customer are auto-cancelled; losing station owner receives: "⚠️ تم إلغاء الطلب. لقد قام الزبون بالحجز في مغسلة أخرى بسبب التأخر في الرد."

---

## [2026-04-16] — Concept 1: Conflict Resolution & Anti-Spam

### Backend (`whatsapp-webhook` v32)
- `createBookingAndNotifyOwner`: before inserting, queries for existing `pending` booking for the same customer phone
- If found: blocks new booking and sends interactive message: "⚠️ لديك حجز قيد الانتظار في مغسلة X. ماذا تود أن تفعل؟"
  - Buttons: `🗑️ إلغاء والبدء من جديد` | `📅 تعديل وقت الحجز`
- New step `conflict_pending`:
  - `conflict_cancel` → cancels old booking, resets to main menu
  - `conflict_reschedule` → cancels old booking, **smart-jumps** to time/day picker for same station+service (no full restart)

---

## [2026-04-16] — Fix: Booking Requires Owner Approval

### Backend (`whatsapp-webhook` v30–v31)
- **Root cause fixed**: `BOT_CONFIRMATION_MESSAGE` DB setting was sent to customer immediately on booking
- Customer now always receives "📩 تم استلام طلب حجزك — ⏳ في انتظار تأكيد صاحب المغسلة"
- Owner receives structured notification with 3 buttons: `✅ تأكيد` | `❌ رفض` | `📅 تغيير الموعد`
- `owner_approve_reject` step fully rewritten:
  - Reschedule: cancels + notifies customer with rebook button
  - Approve: asks optional offer/note → then confirms
  - Reject: cancels + notifies customer with rebook button
- New helper `confirmBookingAndNotifyCustomer`: confirms booking in DB, sends full details + Google Maps to customer, resets sessions
- Nearest station search radius reduced from 30 km → 15 km (`v31`)

---

## [2026-04-16] — Feature: Employee Accounts, Notification Bell, Bulk Broadcast, Excel Export

### Database
- New table `employees` (id, user_id, name, email, can_create_owners, can_create_stations, is_active, created_by)
- `app_role` enum: added `'employee'`
- `station_owners.created_by UUID` added
- `stations.created_by UUID` added
- `notifications.user_id` made nullable

### Edge Functions
- `create-employee` v1: creates auth user + employee record + assigns role
- `delete-employee` v1: removes employee record + deletes auth user
- `create-station-owner` v2: accepts employee callers, tracks `created_by`
- `whatsapp-webhook` v29: `notifyAdmin` inserts DB notification + sends WhatsApp to admin

### Frontend
- **AdminEmployees** page + **EmployeesTab** component: full CRUD, toggle active, Excel export (3 sheets per employee)
- **EmployeeDashboard** + **EmployeeLayout**: employee portal with permission-gated actions
- **NotificationBell**: realtime bell icon in admin header, unread badge, mark read
- **AdminBroadcast**: bulk WhatsApp to filtered owners (all/active/suspended), progress bar
- **AdminSidebar**: added Employees and Broadcast links
- **AuthGuard**: redirects employees to `/app/employee`
- **App.tsx**: new routes `/admin/employees`, `/admin/broadcast`, `/app/employee`

---

## [2026-04-15] — Fix: AuthGuard, WhatsApp-Send 400, React Router Warnings

- Fixed `AuthGuard` navigation to use `navigate()` correctly
- Fixed `whatsapp-send` 400 error (request body schema)
- Suppressed React Router v7 future flag warnings
- OwnersTab: full CRUD + toggle active implemented

---

## [2026-04-10] — Fix: Deno 2 / npm: Imports

- Replaced all `esm.sh` imports with `npm:` protocol for Deno 2 compatibility across all edge functions

---

## [2026-04-10] — Feature: Google Maps Link After Confirmation

- After owner approves booking, customer receives Google Maps link to station location
- Uses GPS coordinates if available, falls back to address search URL

---

## [2026-04-10] — Feature: Admin Bot Logic & Three-Tier Routing

- Added admin bot commands: daily/weekly/monthly booking reports
- Three-tier routing in webhook: customer → owner → admin
- Owner phone detection via Iraqi international format regex (`9647\d{9}`)

---

## [2026-04-10] — Feature: Owner Button Flow Overhaul

- `showOwnerMenu` uses `sendWhatsAppList` with `pending_UUID` IDs
- `owner_view_pending` handles list replies
- Approve/reject/reschedule flow with interactive buttons
- `owner_refresh` button to reload pending list
