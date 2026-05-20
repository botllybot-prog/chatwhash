# Washlly Website API Documentation

Last updated: 2026-05-20

## Overview

Washlly uses Supabase for database, authentication, REST access, realtime data, and Edge Functions.

- Supabase project URL: `https://yhklvtzonvgzkodysawu.supabase.co`
- Edge Functions base URL: `https://yhklvtzonvgzkodysawu.supabase.co/functions/v1`
- REST base URL: `https://yhklvtzonvgzkodysawu.supabase.co/rest/v1`
- Public anon key: stored in `src/integrations/supabase/client.ts`
- Protected owner/admin operations: Supabase Auth user access token
- Server-only operations: Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` internally

Current booking direction:

- Customer and station booking actions now happen inside the website/app inbox.
- WhatsApp is kept for subscriptions, suspension/package notices, and admin broadcasts.
- The WhatsApp webhook no longer confirms, rejects, cancels, postpones, or rates bookings.

## Common Headers

For Edge Functions:

```http
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY or user_access_token>
```

For direct REST:

```http
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <USER_ACCESS_TOKEN or SUPABASE_ANON_KEY>
```

## Public Website Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/map` | Customer portal, inbox, quick booking, regular booking, map, install button |
| `/customer-login` | Direct customer login with name/phone |
| `/stations-list` | Public station list |
| `/owner` | Owner registration/login |
| `/login` | Admin/employee/station owner login |
| `/app/*` | Protected admin/owner/employee app |

## Customer Login and Session APIs

### `customer-login-by-phone`

Creates or resumes a direct customer web session by phone number. No OTP is required. On first use, the customer must provide a name; later logins can use the phone number only.

```http
POST /functions/v1/customer-login-by-phone
```

Request:

```json
{
  "customer_phone": "07736635435",
  "customer_name": "Mustafa"
}
```

Success:

```json
{
  "success": true,
  "requires_verification": false,
  "requires_name": false,
  "session_token": "customer-session-token",
  "expires_at": "2027-05-20T12:00:00.000Z",
  "customer_phone": "9647736635435",
  "customer_name": "Mustafa"
}
```

Success when the phone needs a name:

```json
{
  "success": true,
  "requires_verification": false,
  "requires_name": true,
  "customer_phone": "9647736635435"
}
```

### `customer-update-profile`

Updates the customer display name for an existing customer session. Phone changes should be handled as a new direct login with the new phone number.

```http
POST /functions/v1/customer-update-profile
```

Request:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "customer_name": "Mustafa Azmi"
}
```

Success:

```json
{
  "success": true,
  "customer_name": "Mustafa Azmi"
}
```

## Customer Inbox and Booking APIs

### `customer-get-inbox`

Returns customer inbox notifications and visible bookings. This powers the customer mailbox and in-app notification bell.

```http
POST /functions/v1/customer-get-inbox
```

Request:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token"
}
```

Success:

```json
{
  "success": true,
  "notifications": [
    {
      "id": "uuid",
      "title": "Booking confirmed",
      "body": "Washlly - booking #305 confirmed",
      "reference_booking_id": "uuid",
      "is_read": false,
      "created_at": "2026-05-17T12:00:00.000Z"
    }
  ],
  "bookings": [
    {
      "id": "uuid",
      "booking_number": 305,
      "booking_date": "2026-05-17",
      "booking_time": "19:30",
      "status": "confirmed",
      "customer_rating": null,
      "rated_at": null,
      "stations": { "name": "Washlly" },
      "services": { "name": "General wash" }
    }
  ]
}
```

Visible booking statuses: `pending`, `pending_owner_approval`, `pending_customer_approval`, `confirmed`, `completed`, `cancelled`.

### `customer-mark-notification-read`

Marks one customer inbox notification as read, or marks all notifications as read.

```http
POST /functions/v1/customer-mark-notification-read
```

Request for one notification:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "notification_id": "uuid"
}
```

Request for all:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "mark_all": true
}
```

Success:

```json
{ "success": true }
```

### `customer-list-bookings`

Returns the latest customer bookings.

```http
POST /functions/v1/customer-list-bookings
```

Request:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token"
}
```

Success:

```json
{
  "success": true,
  "bookings": []
}
```

### `customer-manage-booking`

Lets the customer cancel, request a postponement, or accept a station-proposed postponement. It notifies the station owner inside the station portal.

```http
POST /functions/v1/customer-manage-booking
```

Actions:

- `cancel`
- `postpone`
- `accept_postpone`

Cancel request:

```json
{
  "booking_id": "uuid",
  "action": "cancel",
  "customer_phone": "07736635435",
  "session_token": "customer-session-token"
}
```

Postpone request:

```json
{
  "booking_id": "uuid",
  "action": "postpone",
  "booking_date": "2026-05-17",
  "booking_time": "20:30",
  "customer_phone": "07736635435",
  "session_token": "customer-session-token"
}
```

Accept station-proposed time:

```json
{
  "booking_id": "uuid",
  "action": "accept_postpone",
  "customer_phone": "07736635435",
  "session_token": "customer-session-token"
}
```

Success:

```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "booking_number": 305,
    "status": "cancelled",
    "booking_date": "2026-05-17",
    "booking_time": "20:30"
  },
  "cancelledAlternatives": 0
}
```

Rules:

- Only active bookings can be changed: `pending`, `pending_owner_approval`, `pending_customer_approval`, `confirmed`.
- A postponed booking becomes `pending_owner_approval`.
- Accepting a proposed time confirms the booking.
- When one booking becomes confirmed, pending alternative bookings for the same customer/date/time can be cancelled automatically.

### `customer-submit-rating`

Customer confirms the job is completed and submits a 1-5 station rating.

```http
POST /functions/v1/customer-submit-rating
```

Request:

```json
{
  "booking_id": "uuid",
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "rating": 5
}
```

Success:

```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "booking_number": 305,
    "status": "completed",
    "customer_rating": 5,
    "rated_at": "2026-05-17T12:00:00.000Z",
    "station_id": "uuid"
  }
}
```

Rules:

- Rating must be an integer from `1` to `5`.
- Booking must belong to the customer session.
- Booking must be `confirmed` or `completed`.
- A booking can be rated only once.
- The function updates station rating summary and creates an admin notification.

## Booking Creation APIs

### `spin-booking-discount`

Creates a signed one-time discount token for regular map bookings.

```http
POST /functions/v1/spin-booking-discount
```

Request:

```json
{
  "station_id": "uuid",
  "service_id": "uuid",
  "booking_date": "2026-05-17",
  "booking_time": "18:30",
  "customer_phone": "07736635435"
}
```

Success:

```json
{
  "success": true,
  "segmentKey": "discount_10",
  "discountPercent": 10,
  "label": "10%",
  "token": "signed-token"
}
```

Supported discounts: `0`, `5`, `10`, `15`. Token expires after 15 minutes.

### `create-map-booking`

Creates a regular booking for a selected station/service after the discount spin. The website fills customer name and phone from the customer session.

```http
POST /functions/v1/create-map-booking
```

Request:

```json
{
  "station_id": "uuid",
  "service_id": "uuid",
  "customer_name": "Mustafa",
  "customer_phone": "07736635435",
  "booking_date": "2026-05-17",
  "booking_time": "18:30",
  "spin_discount_percent": 10,
  "spin_token": "signed-token",
  "language": "ar"
}
```

Success:

```json
{
  "success": true,
  "bookingId": "uuid",
  "bookingNumber": 305,
  "status": "pending_owner_approval"
}
```

Behavior:

- Validates station, service, date, time, and spin token.
- Blocks customers marked as blocked in `customer_profiles`.
- Prevents duplicate active booking for the same customer/station/date/service.
- Allows up to 3 active bookings per customer.
- Consumes station free/paid request quota.
- Inserts owner/admin in-app notifications.
- Inserts customer inbox notification.
- Does not send booking approval actions through WhatsApp.

### `create-quick-booking`

Creates quick bookings for up to the nearest eligible stations within 15 km. It excludes stations already targeted by the customer's pending quick requests and active bookings.

```http
POST /functions/v1/create-quick-booking
```

Request:

```json
{
  "customer_name": "Mustafa",
  "customer_phone": "07736635435",
  "booking_date": "2026-05-17",
  "booking_time": "18:30",
  "service_kind": "quick",
  "language": "ar",
  "customer_lat": 36.1911,
  "customer_lng": 44.0092,
  "exclude_station_ids": []
}
```

Success:

```json
{
  "success": true,
  "request_id": "uuid",
  "target_count": 3,
  "targets": [
    {
      "station_id": "uuid",
      "booking_id": "uuid",
      "booking_number": 306,
      "station_name": "Washlly",
      "distance_km": 1.24
    }
  ],
  "skipped": [],
  "message": "Quick booking request sent."
}
```

Behavior:

- Searches only within `15 km`.
- Sorts all eligible stations by exact customer-to-station distance, then by station name and id as stable tie-breakers, before creating up to 3 booking targets.
- Does not filter by service name; it uses the first active service for each station.
- Requires an active station owner with `user_id`.
- Allows up to 3 active bookings per customer total.
- Excludes stations already targeted in pending quick requests.
- Consumes request quota per target station.
- Inserts customer inbox notifications.
- Inserts owner in-app notifications.
- Does not send booking approval actions through WhatsApp.

Common business errors:

| Status | Error |
| --- | --- |
| 400 | `Missing required fields` |
| 400 | `location_required` |
| 403 | `customer_blocked` |
| 409 | `active_limit` |
| 200 | `no_station_found` |
| 200 | `no_quota_available` |

### `cancel-map-booking`

Cancels one booking by booking id and customer phone.

```http
POST /functions/v1/cancel-map-booking
```

Request:

```json
{
  "booking_id": "uuid",
  "customer_phone": "07736635435"
}
```

Success:

```json
{
  "success": true,
  "bookingNumber": 305
}
```

### `cancel-all-map-bookings`

Cancels all active bookings for a customer phone. Also cancels quick booking targets and notifies station owners inside the portal.

```http
POST /functions/v1/cancel-all-map-bookings
```

Request:

```json
{
  "customer_phone": "07736635435",
  "language": "ar"
}
```

Success:

```json
{
  "success": true,
  "cancelledCount": 3,
  "alreadyEmpty": false
}
```

## Owner APIs

### `owner-self-register`

Creates a station owner account, station, services, free quota, and Auth user.

```http
POST /functions/v1/owner-self-register
```

Request:

```json
{
  "owner_name": "Mustafa",
  "owner_phone": "07736635435",
  "email": "optional@example.com",
  "password": "123456",
  "free_requests_quota": 20,
  "station": {
    "name": "Washlly",
    "address": "Erbil",
    "detailed_address": "Near main street",
    "working_hours_start": "08:00",
    "working_hours_end": "22:00",
    "scheduling_type": "slots",
    "slot_duration_minutes": 30,
    "latitude": 36.1911,
    "longitude": 44.0092,
    "image_url": null,
    "category": "car_wash"
  },
  "services": [
    {
      "name": "General wash",
      "price": 8000,
      "duration_minutes": 30,
      "customer_discount": null,
      "sort_order": 0
    }
  ]
}
```

Success:

```json
{
  "success": true,
  "user_id": "uuid",
  "station_id": "uuid",
  "email": "owner-9647736635435@washlly.local"
}
```

Notes:

- Iraqi local phone `07xxxxxxxxx` is normalized to `9647xxxxxxxxx`.
- Default free quota is `20`.
- If a stale Auth user exists without an active `station_owners` row, the function can delete the orphan and allow registration again.

### `owner-login-lookup`

Finds the hidden Supabase Auth email for station owner login by phone or owner name.

```http
POST /functions/v1/owner-login-lookup
```

Request:

```json
{
  "identifier": "07736635435"
}
```

Success:

```json
{
  "success": true,
  "email": "owner-9647736635435@washlly.local"
}
```

### `owner-manage-booking`

Lets an authenticated station owner confirm, reject, or propose a new time for one booking. Used by the station portal.

```http
POST /functions/v1/owner-manage-booking
Authorization: Bearer <OWNER_USER_ACCESS_TOKEN>
```

Actions:

- `confirm`
- `reject`
- `postpone`

Confirm request:

```json
{
  "booking_id": "uuid",
  "action": "confirm"
}
```

Reject request:

```json
{
  "booking_id": "uuid",
  "action": "reject"
}
```

Postpone request:

```json
{
  "booking_id": "uuid",
  "action": "postpone",
  "booking_date": "2026-05-17",
  "booking_time": "20:30"
}
```

Success:

```json
{
  "success": true,
  "booking": {
    "id": "uuid",
    "booking_number": 305,
    "status": "confirmed",
    "booking_date": "2026-05-17",
    "booking_time": "18:30"
  },
  "cancelledAlternatives": 2
}
```

Rules:

- Only station owner of the booking station can act.
- Only `pending` and `pending_owner_approval` bookings are actionable.
- Owner action is one-time. Cancelled/confirmed/non-actionable bookings return `409`.
- Confirming one booking cancels pending alternatives for same customer/date/time and notifies those station owners.
- Each action creates a customer inbox notification.

### Other owner/admin functions

| Function | Purpose |
| --- | --- |
| `create-station-owner` | Admin/employee function to attach an owner to an existing station |
| `delete-station-owner` | Admin function to delete a station owner, role, notifications, and Auth user |
| `create-employee` | Admin function to create employee Auth user and permissions |
| `delete-employee` | Admin function to remove employee records |
| `notify-station-owner` | Internal helper for station-owner app notifications |

## Admin and Rating Data

Ratings are stored on `bookings` and summarized on `stations`.

Relevant columns:

| Table | Columns |
| --- | --- |
| `bookings` | `customer_rating`, `rated_at`, `rating_requested`, `rating_requested_at` |
| `stations` | `rating_average`, `rating_count` |
| `customer_notifications` | Customer inbox notifications |
| `notifications` | Owner/admin notifications |

Fetch rated bookings for admin:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/bookings?customer_rating=not.is.null&select=id,booking_number,customer_name,customer_phone,customer_rating,rated_at,created_at,stations(name),services(name)&order=rated_at.desc" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <ADMIN_USER_ACCESS_TOKEN>"
```

Fetch station rating summary:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/stations?select=id,name,rating_average,rating_count&rating_count=gt.0&order=rating_average.desc" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

## Direct Supabase Tables Used by Website

| Table | Purpose |
| --- | --- |
| `stations` | Station profile, location, working hours, category, active status, rating summary |
| `services` | Station services, prices, durations |
| `bookings` | Regular and quick booking rows, statuses, ratings |
| `station_owners` | Owner phone/user/station link, free quota |
| `quick_booking_requests` | Parent quick booking request |
| `quick_booking_targets` | Stations targeted by quick booking |
| `customer_profiles` | Customer name, phone, blocked status |
| `customer_login_codes` | Legacy OTP table, not used by the current direct customer login flow |
| `customer_web_sessions` | Persistent customer web sessions |
| `customer_notifications` | Customer inbox notifications |
| `notifications` | Owner/admin in-app notifications |
| `subscriptions` | Paid package subscriptions |
| `payments` | Payment records |
| `app_settings` | WhatsApp/payment/bot settings |
| `conversations` | WhatsApp/Telegram conversation audit |
| `messages` | Inbound/outbound bot/admin messages |
| `employees` | Employee accounts and permissions |
| `user_roles` | User role mapping |
| `edit_requests` | Legacy owner requested profile edits |

## Common REST Examples

Fetch active stations:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/stations?is_active=eq.true&select=*" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

Fetch services for a station:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/services?station_id=eq.<STATION_ID>&is_active=eq.true&select=*" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

Fetch owner bookings:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/bookings?station_id=eq.<STATION_ID>&select=*,services(name,price)&order=created_at.desc" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <OWNER_USER_ACCESS_TOKEN>"
```

Fetch customer profiles for admin:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/customer_profiles?select=*&order=created_at.desc" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <ADMIN_USER_ACCESS_TOKEN>"
```

Block a customer from booking:

```bash
curl -X PATCH "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/customer_profiles?customer_phone=eq.9647736635435" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <ADMIN_USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "is_blocked": true }'
```

## WhatsApp APIs

### `whatsapp-send`

Sends a WhatsApp text message through WhatsApp Cloud API. Used for admin broadcasts or direct messages, not booking actions.

```http
POST /functions/v1/whatsapp-send
```

Request:

```json
{
  "phone": "9647836635435",
  "message": "Hello",
  "conversation_id": "optional-uuid"
}
```

Success:

```json
{
  "success": true,
  "whatsapp_message_id": "wamid..."
}
```

### `whatsapp-webhook`

Incoming WhatsApp webhook.

Current behavior:

- Verifies webhook subscription on `GET`.
- Audits inbound WhatsApp messages into `conversations` and `messages`.
- Does not run booking flows.

POST success:

```json
{
  "received": true,
  "bookingFlowDisabled": true
}
```

### Subscription and package functions

| Function | Purpose |
| --- | --- |
| `check-subscriptions` | Scheduled function for expired subscriptions/free quota visibility |
| `send-suspension-notice` | Sends suspension/quota/package notices to station owners |
| `payment-callback` | Payment provider callback handler |

## Deployment

Apply database migrations:

```bash
npx supabase db push
```

Deploy booking/customer functions:

```bash
npx supabase functions deploy customer-login-by-phone
npx supabase functions deploy customer-update-profile
npx supabase functions deploy customer-get-inbox
npx supabase functions deploy customer-mark-notification-read
npx supabase functions deploy customer-list-bookings
npx supabase functions deploy customer-manage-booking
npx supabase functions deploy customer-submit-rating
npx supabase functions deploy owner-manage-booking
npx supabase functions deploy create-map-booking
npx supabase functions deploy create-quick-booking
npx supabase functions deploy cancel-map-booking
npx supabase functions deploy cancel-all-map-bookings
npx supabase functions deploy spin-booking-discount
```

Deploy owner/admin/WhatsApp functions:

```bash
npx supabase functions deploy owner-self-register
npx supabase functions deploy owner-login-lookup
npx supabase functions deploy create-station-owner
npx supabase functions deploy delete-station-owner
npx supabase functions deploy create-employee
npx supabase functions deploy delete-employee
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-send
npx supabase functions deploy booking-reminders
npx supabase functions deploy check-subscriptions
npx supabase functions deploy send-suspension-notice
npx supabase functions deploy payment-callback
```

Important: if the remote database already has old migrations manually applied, `db push` can fail on existing objects. Inspect migration history before forcing changes.

## Minimal Mobile Integration Flow

1. Customer opens app.
2. Call `customer-login-by-phone` with `customer_phone` and, on first use, `customer_name`.
3. Store `customer_phone`, `customer_name`, and `session_token` locally.
4. Use `customer-get-inbox` to render inbox, booking status, notification count, and bell sound trigger.
5. For regular booking, call `spin-booking-discount`, then `create-map-booking`.
6. For quick booking, call `create-quick-booking`; it targets the nearest eligible stations within 15 km in deterministic distance order.
7. For customer actions, call `customer-manage-booking`.
8. After a confirmed job is completed, call `customer-submit-rating`.
