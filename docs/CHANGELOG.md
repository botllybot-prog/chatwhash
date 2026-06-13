# CHANGELOG — Car Wash Booking Bot

All notable changes to this project are documented here.  
Format: `## [YYYY-MM-DD] — Title`

---

## [2026-06-14] - Firebase Cloud Messaging Backend

- Added the `device_tokens` table for storing Android/iOS FCM tokens by customer or station owner phone number.
- Added the `send-notification` Supabase Edge Function to send FCM v1 push notifications through Firebase service-account secrets.
- Added the `notify-on-booking-change` Edge Function for booking insert/update push notifications.
- Added a database trigger on `bookings` so booking creation and status changes call the notification function automatically.
- Configured and verified the Firebase secrets in Supabase Edge Functions: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, and `FCM_PRIVATE_KEY`.
- Updated API documentation and Postman collection with FCM push notification endpoints and REST device token examples.

## [2026-05-17] - Customer Inbox Ratings and Booking Bot Cleanup

- Added customer in-app booking rating flow, admin ratings view, and station rating summaries on the map.
- Improved customer rating stars with clearer 1-5 labels and lighter unselected star styling.
- Updated API documentation for customer sessions, inbox actions, ratings, owner booking actions, and the reduced WhatsApp webhook scope.
- Updated the Postman collection with the latest customer inbox, booking action, rating, owner portal, REST, and WhatsApp utility requests.
- Added an admin reservation delete action that removes bookings from the admin panel and station portal.
- Added Google Maps station directions to customer confirmation notifications and confirmed booking cards.
- Fixed customer login so WhatsApp OTP is required before session creation, including after replacing the phone number.
- Enabled the main `/login` page to accept station owner mobile numbers as well as email addresses.
- Remembered verified customer phone numbers in the database so repeat customer login no longer sends another OTP.
- Validated customer session database writes before returning successful OTP verification or remembered login responses.
- Disabled customer OTP login and switched customer access to direct name/phone login with saved customer profile sessions.
- Kept booking notifications and actions inside the web app, while cleaning the WhatsApp webhook so it no longer handles booking confirmation, cancellation, or rating flows.
- Removed obsolete Expo mobile app code and the `/mobile-map` web route.
- Made quick booking station targeting deterministic by nearest distance, with stable tie-breaking, and corrected owner booking bell messages for cancellation, confirmation, and time-change events.
- Updated the API documentation and Postman collection for direct customer name/phone login without OTP and the deterministic quick-booking targeting behavior.
- Added the `/more` and `/privacy-policy` public pages, replaced the bottom WhatsApp shortcut with More/Map/Stations navigation, and verified the API collection smoke test after deploying `customer-list-bookings`.

## [2026-05-09] - Mobile Owner Portal & Quick Booking

- Updated the Expo mobile app with persistent owner login, station photo upload, editable station info, owner-side booking actions, 24-hour booking stats, compact quota summaries, and package renewal requests to admin notifications/WhatsApp.
- Added customer-side mobile quick booking with location support, map-first flow, removed governorate filtering, and refreshed the discount wheel display.
## [2026-05-08] — Quick Booking Distance Match & WhatsApp Actions

- Quick booking now matches nearby stations by distance only and no longer rejects stations because their active service name differs from the selected quick-booking label.
- Updated the customer WhatsApp confirmation after quick booking with the 15 km resend notice and action buttons for current stations, cancelling quick bookings, and returning to the map.
## [2026-04-23] — Advanced Debt Collection, Suspension Flow & Payment Gateway

### New Features

#### 🔴 Interactive Suspension Flow (WhatsApp)
When an admin suspends a station owner, the bot now sends an interactive WhatsApp message instead of a static text:
1. **Step 1 — Payment Method Buttons:** Owner receives suspension notice with their outstanding debt amount and three buttons: `💚 زين كاش` · `🔵 سوبر كي` · `🟠 ناس وولت`
2. **Step 2 — Invoice:** Selecting a method shows a full invoice: debt amount, chosen method, account number, and two action buttons: `✅ تم الدفع` · `⏳ تأجيل الدفع`
3. **Step 3a — Payment Claimed:** Bot confirms to owner that admin will verify manually. Admin receives WhatsApp: *"🔔 إشعار دفع من مغسلة [name] — المبلغ: [X] دينار — يرجى التحقق وإعادة التفعيل يدوياً"*
4. **Step 3b — Postpone:** Bot sends polite acknowledgment and session resets.
- **No auto-unsuspend** — admin must manually re-activate via Admin Panel.
- New bot session steps: `owner_payment_method`, `owner_payment_confirm`

#### 🆕 New Edge Function: `send-suspension-notice`
- Called automatically by `OwnersTab` when an owner is suspended from Admin Panel
- Sends the interactive suspension WhatsApp message and sets bot session to `owner_payment_method`
- Auth: service-role header required
- Body: `{ owner_id: string }`

#### 💰 Outstanding Debt Field (`station_owners.outstanding_debt`)
- New `NUMERIC DEFAULT 0` column added to `station_owners` table via `scripts/migrate7.cjs`
- Shown in the Owners table: red if > 0, green if 0
- Editable in Edit Owner dialog with label "الذمة المالية المستحقة (دينار عراقي)"
- Debt amount appears in WhatsApp suspension notice and invoice

#### 🚫 Exclude Suspended Stations from Customer Searches
- `showStationsPage`, `searchStations`, and `handleLocationMessage` now pre-fetch suspended station IDs and exclude them from all query results
- Helper: `getSuspendedStationIds(supabase)` — queries `station_owners WHERE is_active = false`
- Customers can no longer find or book a station whose owner is suspended

### Files Changed
| File | Change |
|------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Interactive suspension flow, station exclusion, `outstanding_debt` in `checkIfOwner` |
| `supabase/functions/send-suspension-notice/index.ts` | **NEW** — suspension WhatsApp sender |
| `src/components/bot-admin/OwnersTab.tsx` | `outstanding_debt` field, suspension notification trigger |
| `scripts/migrate7.cjs` | **NEW** — DB migration for `outstanding_debt` column |

---

## [2026-04-17] — Critical Bugfix: Status Overwrite + Phase 2 Owner Proposes Time + CSV Export

### Root Cause Analysis — Why Bookings Showed as Cancelled

Three bugs combined to produce the symptom "all confirmed bookings show as cancelled":

1. **`approve_reschedule` immediately cancelled the booking** — This was the primary revenue killer. When an owner clicked "📅 تغيير الموعد" (Change Time), the webhook immediately ran `UPDATE bookings SET status='cancelled'`. Owners who intended to pick an alternative time were unknowingly cancelling every booking.

2. **`booking-reminders` used wrong table and column** — The timeout alert session update used `supabase.from("sessions").update(...).eq("phone", ...)` but the correct table is `bot_sessions` with column `customer_phone`. This meant timeout session steps silently failed and customers were stuck in limbo.

3. **`conflict_cancel` / `conflict_reschedule` had no status guard** — A customer could accidentally cancel a confirmed booking via the conflict UI if the booking was already approved by the owner.

### Bug Fixes

#### DB (`scripts/migrate6.cjs`)
- Added `pending_customer_approval` to `booking_status` enum
- Added `proposed_time TIME` column to `bookings` (owner's suggested new time)
- Added `proposed_date DATE` column to `bookings` (owner's suggested new date)

#### Backend — `whatsapp-webhook` v35
- **`approve_reschedule` (CRITICAL FIX)**: No longer cancels immediately. Now shows the owner the available time slots for today using `sendWhatsAppList`. Owner selects a slot → new step `owner_propose_time`.
- **New step `owner_propose_time`**: Owner selects proposed time → booking set to `pending_customer_approval` + `proposed_time` + `proposed_date`. Customer receives interactive message with 2 buttons.
- **New customer step `awaiting_new_time_approval`**:
  - `new_time_accept` → `confirmed`, updates `booking_time`, notifies owner ✅
  - `new_time_reject` → `cancelled`, shows search button 🔍
- **`conflict_cancel`**: Now uses `.eq("status", "pending")` guard — will **never** cancel a confirmed booking
- **`conflict_reschedule`**: Same guard added

#### Backend — `booking-reminders` v4 (was showing as v3 in Supabase)
- **Fixed**: `.from("sessions")` → `.from("bot_sessions")`
- **Fixed**: `.eq("phone", ...)` → `.eq("customer_phone", ...)`
- Added `expires_at` update to session update query

### New Feature — CSV Export (`AdminBookings.tsx`)
- Added **date range filter** (from/to date pickers)
- Added **"📊 تصدير CSV (مؤكد)"** button — exports only `status = confirmed` bookings
- Filters: station + date range apply to export
- CSV includes: رقم الحجز, اسم العميل, هاتف العميل, المحطة, الخدمة, السعر, التاريخ, الوقت, تاريخ الإنشاء
- File name: `حجوزات_مؤكدة_{station}_{date}.csv` with UTF-8 BOM for Arabic Excel compatibility
- Added `pending_customer_approval` as new selectable status in filter and status dropdown
- `customer_name` now shown in bookings table (was `customer_phone` only before)


## [2026-04-17] — Phase 1: Fix Push Notification Race Condition & Employee RLS

### Bug 1 Fix — Push Notification (`whatsapp-webhook` v34)
- **Root cause**: Owner notification was a fire-and-forget `.then()` promise. In Deno serverless edge functions, unresolved promises are killed when the HTTP response is sent — meaning the owner never received the WhatsApp message.
- **Fix**: Extracted owner notification into a named IIFE promise (`notifyOwnerPromise`), then `await Promise.all([custSend, notifyOwnerPromise])` before returning. Both customer confirmation and owner notification now run in parallel and are guaranteed to complete.
- Added explicit error logging: `[OWNER_NOTIFY]` logs distinguish between DB errors, missing owner, and failed WhatsApp API calls (null `waId` indicates missing `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` in `app_settings`).
- Phone format validation confirmed: `normalizePhone()` converts `07XXXXXXXXX` → `9647XXXXXXXXX` (no `+`, no `00`).

### Bug 2 Fix — Employee RLS (`scripts/migrate5.cjs`)
- **Root cause**: `stations` table only had `"Admins can insert stations"` policy. No policy existed for employees. Same for `services`. All employee INSERT/UPDATE operations were blocked at the database level.
- **New policies applied**:
  - `stations`: `"Employees can insert stations"` — INSERT allowed when `employees.can_create_stations = true AND is_active = true`
  - `services`: `"Employees can insert services"` — INSERT allowed when `employees.can_add_service = true AND is_active = true`
  - `services`: `"Employees can update service prices"` — UPDATE allowed when `employees.can_edit_prices = true AND is_active = true`
  - `employees`: `"Employees can read own record"` — SELECT allowed for `user_id = auth.uid()` (needed for permission self-checks)


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
