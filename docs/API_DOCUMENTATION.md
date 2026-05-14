# Washlly Website API Documentation

Last updated: 2026-05-10

## Overview

Washlly uses Supabase as the backend for the website and mobile app.

- Supabase project URL: `https://yhklvtzonvgzkodysawu.supabase.co`
- Edge Functions base URL: `https://yhklvtzonvgzkodysawu.supabase.co/functions/v1`
- Public anon key: stored in `src/integrations/supabase/client.ts` and `mobile-app/src/lib/supabase.ts`
- Auth: Supabase Auth JWT for protected dashboard operations.
- Admin/server-only work: Supabase Edge Functions use `SUPABASE_SERVICE_ROLE_KEY` internally.

## Postman Collection (Ready)

Use this file directly:

- `docs/Washlly_API_Postman_Collection.json`

It already includes:

- Correct Supabase project URL.
- Edge Functions and REST endpoint groups.
- Default `anon` key in both `apikey` and `Authorization`.
- Pre-filled body examples for booking and owner flows.

If you need role-protected REST rows, replace only:

- `authToken` with logged-in user access token

Leave `anonKey` as-is unless you rotate keys.

## API Test Checklist (Pass Criteria)

Use this exact order in Postman:

1. `owner-login-lookup` with a real registered owner phone.
2. `create-quick-booking` with valid `customer_lat` and `customer_lng`.
3. `cancel-all-map-bookings` for the same phone.
4. `stations (active)` REST endpoint.
5. `services by station` REST endpoint.

Expected pass conditions:

- Any successful function call returns HTTP `200` with `"success": true`.
- Validation failures can still return HTTP `200` for business flow errors (`no_station_found`, `no_quota_available`), and this is valid behavior.
- Missing required input returns HTTP `400` with explicit `error` field.
- `create-map-booking` requires a valid `spin_token` from `spin-booking-discount`; otherwise it should fail by design.

Common setup mistakes that cause false failures:

- Wrong `stationId` or `serviceId` placeholders not replaced.
- Empty `authToken` variable.
- Sending local phone in unsupported format; preferred Iraqi format is `07xxxxxxxxx` (normalized internally).
- Testing protected REST rows with anon token only (use logged-in user token when RLS requires it).

All Edge Functions accept JSON and support CORS preflight.

Common headers:

```http
Content-Type: application/json
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY or user_access_token>
```

For Postman testing, start with:

- `apikey: {{anonKey}}`
- `Authorization: Bearer {{authToken}}`

For browser/mobile calls using `supabase.functions.invoke()`, Supabase automatically sends the required project headers.

## Public Website Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page |
| `/map` | Full web map, quick booking, regular booking, install button |
| `/mobile-map` | Compact map for the native mobile app WebView only |
| `/stations-list` | Public station list |
| `/owner` | Owner registration/login |
| `/login` | Admin/employee/station owner login |
| `/app/*` | Protected admin/owner/employee app |

## Core Edge Functions

### `owner-self-register`

Creates a station owner account, station, services, free quota, and Auth user. Used by owner self-registration and admin/employee owner creation flows.

Endpoint:

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
    "image_url": null
  },
  "services": [
    {
      "name": "غسل عام",
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

Common errors:

| Status | Error |
| --- | --- |
| 400 | `Missing required fields` |
| 400 | `Password must be at least 6 characters` |
| 400 | `At least one service is required` |
| 409 | `An account with this WhatsApp number or email already exists` |

Notes:

- Iraqi local phone `07xxxxxxxxx` is normalized to `9647xxxxxxxxx`.
- If a stale Auth user exists without an active `station_owners` row, the function deletes that orphan and allows registration again.
- Default free quota is `20`.

### `owner-login-lookup`

Finds the hidden Supabase Auth email for station owner login by phone or owner name.

Endpoint:

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

Errors: `MISSING_IDENTIFIER`, `OWNER_NOT_FOUND`, `AMBIGUOUS_OWNER_NAME`, `AUTH_USER_NOT_FOUND`.

### `spin-booking-discount`

Creates a signed one-time discount token for regular map bookings. Discounts are limited to `0%`, `5%`, `10%`, `15%`.

Endpoint:

```http
POST /functions/v1/spin-booking-discount
```

Request:

```json
{
  "station_id": "uuid",
  "service_id": "uuid",
  "booking_date": "2026-05-10",
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

Notes:

- Token expires after 15 minutes.
- `create-map-booking` verifies this token before creating the booking.

### `create-map-booking`

Creates a regular booking for a selected station/service after discount spin.

Endpoint:

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
  "booking_date": "2026-05-10",
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
  "bookingNumber": 239,
  "status": "pending"
}
```

Behavior:

- Validates station and service.
- Prevents duplicate active booking for the same station/date/service/customer.
- Limits customer to max two active bookings.
- Consumes station free/paid request quota.
- Inserts app notification for station owner and admin.
- Sends WhatsApp confirmation to customer and interactive WhatsApp approval buttons to station owner.

### `create-quick-booking`

Creates quick bookings for up to the nearest 3 eligible stations within 15 km. It excludes stations already targeted by the customer's pending quick requests.

Endpoint:

```http
POST /functions/v1/create-quick-booking
```

Request:

```json
{
  "customer_name": "Mustafa",
  "customer_phone": "07736635435",
  "booking_date": "2026-05-10",
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
      "station_name": "Washlly",
      "distance_km": 1.24
    }
  ],
  "skipped": [],
  "message": "Quick booking request sent to the nearest 3 stations."
}
```

Behavior:

- Searches only within `15 km`.
- Does not filter by service name; it uses the first active service for each station.
- Requires active station owner with phone.
- Consumes request quota per target station.
- Sends WhatsApp interactive accept/reject/change-time to owners.
- Creates `quick_booking_requests` and `quick_booking_targets`.

Common errors:

| Status | Error |
| --- | --- |
| 400 | `Missing required fields` |
| 400 | `location_required` |
| 200 | `no_station_found` |
| 200 | `no_quota_available` |

### `cancel-map-booking`

Cancels one booking by booking id and customer phone.

Endpoint:

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
  "bookingNumber": 239
}
```

### `cancel-all-map-bookings`

Cancels all active bookings for a customer phone. Also cancels quick booking targets and sends station-owner cancellation notifications.

Endpoint:

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

### `whatsapp-send`

Sends a WhatsApp text message through WhatsApp Cloud API. If `conversation_id` is provided, it saves the outbound message to `messages`.

Endpoint:

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

### `notify-station-owner`

Internal helper to create in-app notifications and/or WhatsApp notification for a station owner.

### `booking-reminders`

Scheduled function. Handles reminders and quick booking timeout follow-up logic.

### `check-subscriptions`

Scheduled function. Checks expired subscriptions/free quota and disables/reactivates station visibility as needed.

### `send-suspension-notice`

Sends suspension or quota-ended WhatsApp notice to station owner.

### `create-station-owner`

Admin/employee function to attach an owner to an existing station.

### `delete-station-owner`

Admin function to delete a station owner, role, notifications, and Auth user.

### `create-employee`

Admin function to create employee Auth user and employee permissions.

### `delete-employee`

Admin function to remove employee records.

### `payment-callback`

Payment provider callback handler for subscriptions/payments.

### `whatsapp-webhook`

Incoming WhatsApp webhook. Handles customer and owner WhatsApp conversation flows.

### `telegram-webhook`

Incoming Telegram webhook. Legacy/parallel bot flow.

## Direct Supabase Tables Used by Website

The website also uses Supabase PostgREST directly. Base REST URL:

```http
https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/<table>
```

Required headers:

```http
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <USER_ACCESS_TOKEN or SUPABASE_ANON_KEY>
Content-Type: application/json
```

Important tables:

| Table | Purpose |
| --- | --- |
| `stations` | Station profile, location, working hours, active status |
| `services` | Services/prices/durations |
| `bookings` | All regular and quick booking rows |
| `station_owners` | Owner phone/user/station link, free quota |
| `quick_booking_requests` | Parent quick booking request |
| `quick_booking_targets` | Stations targeted by quick booking |
| `notifications` | In-app admin/owner notifications |
| `subscriptions` | Paid package subscriptions |
| `payments` | Payment records |
| `app_settings` | WhatsApp/payment/bot settings |
| `conversations` | WhatsApp/Telegram conversations |
| `messages` | Inbound/outbound bot/admin messages |
| `employees` | Employee accounts and permissions |
| `user_roles` | User role mapping |
| `edit_requests` | Owner requested station profile edits |

## Common REST Examples

Fetch active stations:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/stations?is_active=eq.true&select=*" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

Fetch services for station:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/services?station_id=eq.<STATION_ID>&is_active=eq.true&select=*" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <SUPABASE_ANON_KEY>"
```

Fetch owner bookings:

```bash
curl "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/bookings?station_id=eq.<STATION_ID>&select=*,services(name,price)&order=created_at.desc" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>"
```

Update booking status:

```bash
curl -X PATCH "https://yhklvtzonvgzkodysawu.supabase.co/rest/v1/bookings?id=eq.<BOOKING_ID>" \
  -H "apikey: <SUPABASE_ANON_KEY>" \
  -H "Authorization: Bearer <USER_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "confirmed" }'
```

## Mobile App APIs

Mobile app uses the same Supabase backend.

Primary files:

- `mobile-app/src/lib/supabase.ts`
- `mobile-app/src/lib/bookingApi.ts`
- `mobile-app/src/lib/ownerApi.ts`
- `mobile-app/src/lib/subscriptionApi.ts`
- `mobile-app/src/lib/stations.ts`

Mobile booking API wrappers:

| Function | Backend |
| --- | --- |
| `spinBookingDiscount()` | `spin-booking-discount` |
| `createMapBooking()` | `create-map-booking` |
| `createQuickBooking()` | `create-quick-booking` |
| `cancelMapBooking()` | `cancel-map-booking` |
| `cancelAllMapBookings()` | `cancel-all-map-bookings` |
| `fetchCustomerBookings()` | direct `bookings` query |
| `fetchStationsWithServices()` | direct `stations` and `services` queries |

## Environment Variables and Settings

Supabase Edge Functions expect:

| Name | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side DB/Auth access |

Runtime settings are mostly stored in `app_settings`:

| Key | Purpose |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp sender phone number id |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verification |
| `WHATSAPP_UTILITY_TEMPLATE_NAME` | WhatsApp template name |
| `WHATSAPP_UTILITY_TEMPLATE_LANG` | WhatsApp template language |
| `OWNER_PACKAGE_*` | Owner packages/payment copy/settings |

## Deployment

Deploy one Edge Function:

```bash
npx supabase functions deploy create-quick-booking
```

Deploy frequently used functions:

```bash
npx supabase functions deploy owner-self-register
npx supabase functions deploy create-quick-booking
npx supabase functions deploy create-map-booking
npx supabase functions deploy cancel-map-booking
npx supabase functions deploy cancel-all-map-bookings
npx supabase functions deploy spin-booking-discount
npx supabase functions deploy whatsapp-webhook
npx supabase functions deploy whatsapp-send
npx supabase functions deploy booking-reminders
npx supabase functions deploy check-subscriptions
```

Apply database migrations:

```bash
npx supabase db push
```

Important: if the remote DB already has old migrations manually applied, `db push` can fail on existing tables. In that case, inspect migration history before forcing changes.
