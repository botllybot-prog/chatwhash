# Washlly Website API Documentation

Last updated: 2026-08-21

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
- Mobile push notifications are sent through Firebase Cloud Messaging (FCM) using Supabase Edge Functions.

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

## Public Offers API

### `GET /api/v1/offers`

Returns active offer records with their type, ordered details, linked station information, and optional image or video media. This public website route is proxied to the Supabase Edge Function:

```http
GET /functions/v1/get-offers
```

Authentication is optional.

- Offers are assigned to one or more cities from the admin multi-select. They are stored in `offers.cities` as comma-separated text, for example `All,Erbil,Baghdad`, and returned by this endpoint as a `cities` array.
- Unauthenticated requests return only offers whose parsed `cities` array includes `All`.
- Authenticated customer requests may pass `Authorization: Bearer <customer_session_token>` or `x-customer-session-token: <customer_session_token>`. The function reads the customer's saved `customer_profiles.city` and returns offers where the parsed `cities` array includes the customer's city or `All`.
- Supabase Auth bearer tokens are also accepted; when present, the function attempts to read `user_metadata.city`.
- If no city is available from the authenticated context, only `All` offers are returned.

Headers:

```http
Authorization: Bearer <optional_customer_session_or_user_token>
x-customer-session-token: <optional_customer_session_token>
```

Query parameters: none.

Filtering notes:

- City matching is case-insensitive after splitting `offers.cities` by comma.
- `All` makes the offer visible to every request.
- Customer-specific city filtering requires either a valid customer web session token or a Supabase Auth bearer token with city metadata.

Status codes:

| Status | Meaning |
| --- | --- |
| `200 OK` | Offers loaded successfully |
| `405 Method Not Allowed` | Method other than `GET` |
| `500 Internal Error` | Unexpected database or function error |

Example unauthenticated request:

```bash
curl "https://washlly.com/api/v1/offers"
```

Example authenticated request:

```bash
curl "https://washlly.com/api/v1/offers" \
  -H "Authorization: Bearer <CUSTOMER_SESSION_TOKEN>"
```

Example response:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-1283-...",
      "title": "Summer Promotion",
      "type": {
        "id": "uuid-...",
        "name": "Slider"
      },
      "cities": ["All", "Erbil"],
      "details": [
        {
          "id": "uuid-...",
          "title": "Detail Title",
          "body": "Detail Body",
          "url_type": "Inside",
          "url": "/station/123",
          "station": {
            "id": "uuid-...",
            "name": "Station A"
          },
          "sort": 1,
          "media": {
            "url": "https://washlly.com/api/offer-media/media-key/promotion.webp",
            "type": "image/webp",
            "name": "promotion.webp"
          }
        }
      ]
    }
  ]
}
```

## Push Notifications (FCM)

Washlly stores mobile device FCM tokens in `public.device_tokens`, then sends push notifications from Supabase Edge Functions. Tokens are keyed by normalized phone number, role, and platform.

### `device_tokens` REST table

Stores the latest FCM token for a customer or station owner device.

Columns:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Auto-generated primary key |
| `phone` | text | Normalized customer or owner phone, e.g. `9647736635435` |
| `role` | text | `customer` or `owner` |
| `token` | text | FCM registration token from the mobile app |
| `platform` | text | `android` or `ios` |
| `language` | text | `ar`, `en`, or `ku`; defaults to `ar` |
| `created_at` | timestamptz | Insert timestamp |

The table has RLS enabled. Server-side writes use the service role. Mobile apps should normally register tokens through a secure API wrapper before production public release.

Example service-role REST upsert:

```http
POST /rest/v1/device_tokens?on_conflict=phone,role,platform
Prefer: resolution=merge-duplicates
```

```json
{
  "phone": "9647736635435",
  "role": "customer",
  "token": "FCM_DEVICE_TOKEN",
  "platform": "android",
  "language": "ar"
}
```

### `register-device-token`

Used by the mobile app to save or remove a device FCM token. This Edge Function uses the service role key internally to bypass the RLS policy on `device_tokens`, so the mobile app can use the public anon key.

```http
POST /functions/v1/register-device-token
```

Save a token, usually after login:

```json
{
  "action": "save",
  "phone": "9647736635435",
  "role": "customer",
  "token": "FCM_DEVICE_TOKEN",
  "platform": "android",
  "language": "ar"
}
```

Delete a token, usually on logout:

```json
{
  "action": "delete",
  "phone": "9647736635435",
  "role": "customer",
  "token": "FCM_DEVICE_TOKEN",
  "platform": "android"
}
```

Success:

```json
{ "success": true }
```

Fields:

- `role`: `customer` or `owner`
- `platform`: `android` or `ios`
- `language`: `ar`, `en`, or `ku`
- On `save`: upserts the token, keyed by `phone + role + platform`
- On `delete`: removes the matching token row

### `send-notification`

Sends an FCM v1 push notification to every stored device token for a phone/role pair.

```http
POST /functions/v1/send-notification
```

Request:

```json
{
  "phone": "9647736635435",
  "role": "customer",
  "title": "Booking Confirmed",
  "body": "Your booking has been confirmed",
  "data": {
    "booking_id": "booking-uuid",
    "status": "confirmed"
  }
}
```

Success:

```json
{
  "success": true,
  "sent": 1,
  "failed": 0,
  "results": [
    {
      "success": true,
      "token": "FCM_DEVICE_TOKEN",
      "response": "projects/washlly-96de6/messages/..."
    }
  ]
}
```

If no token exists for the phone/role pair:

```json
{
  "success": true,
  "sent": 0,
  "results": []
}
```

Required Supabase Edge Function secrets:

- `FCM_PROJECT_ID`
- `FCM_CLIENT_EMAIL`
- `FCM_PRIVATE_KEY`

### `notify-on-booking-change`

Receives a Supabase database webhook-compatible payload and sends localized FCM notifications for booking events.

```http
POST /functions/v1/notify-on-booking-change
```

The database trigger `trg_notify_booking_change_edge_function` calls this function automatically after booking inserts and after status updates.

Webhook payload:

```json
{
  "type": "UPDATE",
  "record": {
    "id": "booking-uuid",
    "customer_phone": "9647736635435",
    "station_id": "station-uuid",
    "status": "confirmed"
  },
  "old_record": {
    "status": "pending"
  }
}
```

Behavior:

| Event | Recipient | Lookup | Notification |
| --- | --- | --- | --- |
| `INSERT` | Station owner | `station_owners.owner_phone` by `station_id` | New booking at station |
| `UPDATE status=confirmed` | Customer | `record.customer_phone` | Booking confirmed |
| `UPDATE status=rejected` | Customer | `record.customer_phone` | Booking rejected |
| `UPDATE status=cancelled` | Customer | `record.customer_phone` | Booking cancelled |
| `UPDATE status=pending_customer_approval` | Customer | `record.customer_phone` | Reschedule request |
| `UPDATE status=completed` | Customer | `record.customer_phone` | Service completed |

The function ignores status updates where the status did not change, and ignores statuses that are not listed above.

## Customer Login and Session APIs

### `customer-login-by-phone`

Creates or resumes a direct customer web session by phone number. No OTP is required. On first use, the customer must provide a name and a city (city powers the city-based offer filtering used by `GET /api/v1/offers`); later logins can use the phone number only, reusing the previously saved name/city.

```http
POST /functions/v1/customer-login-by-phone
```

Request:

```json
{
  "customer_phone": "07736635435",
  "customer_name": "Mustafa",
  "customer_city": "Erbil"
}
```

`customer_city` must be one of the values in `OFFER_CITY_VALUES` (`src/lib/adminOffersTranslations.ts`), excluding `All` — the same city list used to tag offers in the admin panel.

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

Success when the phone needs a name (no `customer_name` submitted and none saved yet):

```json
{
  "success": true,
  "requires_verification": false,
  "requires_name": true,
  "customer_phone": "9647736635435"
}
```

Success when the phone needs a city (name is resolved, but no `customer_city` submitted and none saved yet):

```json
{
  "success": true,
  "requires_city": true,
  "customer_phone": "9647736635435",
  "customer_name": "Mustafa"
}
```

City is required on first-time registration; once saved, it is reused on later phone-only logins.

### `customer-update-profile`

Updates the customer display name and/or saved city for an existing customer session. Phone changes should be handled as a new direct login with the new phone number.

```http
POST /functions/v1/customer-update-profile
```

Request (at least one of `customer_name` / `customer_city` is required):

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "customer_name": "Mustafa Azmi",
  "customer_city": "Baghdad"
}
```

Success:

```json
{
  "success": true,
  "customer_name": "Mustafa Azmi",
  "customer_city": "Baghdad"
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

## Chat APIs

Customer↔station-owner chat, plus admin-curated group threads mixing owners and customers. Two thread kinds:

- **`direct`** — auto-created the first time a customer messages a station (no booking required). Members are the customer plus every current `station_owners` row for that station, kept in sync automatically if owners are added or removed later.
- **`group`** — created and membership-managed only by admins (via the `/app/admin/chat-groups` dashboard page, not a public API). Can mix any station owners and any customers. Full two-way messaging for every member.

Underlying tables: `chat_threads`, `chat_thread_members`, `chat_messages`. Owners/admins read and send messages via direct Supabase queries (RLS-scoped to their memberships) with Realtime `postgres_changes` subscriptions; customers use the functions below with the same session-token pattern as the rest of the customer API, and poll for updates.

### `customer-send-chat-message`

Sends a text and/or media message. Provide either `thread_id` (an existing thread) or `station_id` (creates the direct thread for that station on first use).

```http
POST /functions/v1/customer-send-chat-message
```

Request:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "station_id": "uuid",
  "body": "هل الخدمة متوفرة اليوم؟"
}
```

Or, replying in an existing thread with media (upload via `chat-media` first, see below):

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "thread_id": "uuid",
  "media_key": "9730c774.../image~jpeg/photo.jpg",
  "media_url": "https://washlly.com/api/chat-media/9730c774.../image~jpeg/photo.jpg",
  "media_type": "image/jpeg",
  "media_name": "photo.jpg"
}
```

Success:

```json
{
  "success": true,
  "thread_id": "uuid",
  "message": {
    "id": "uuid",
    "thread_id": "uuid",
    "sender_type": "customer",
    "sender_id": "9647736635435",
    "sender_name": "Mustafa",
    "body": "هل الخدمة متوفرة اليوم؟",
    "media_key": null,
    "media_url": null,
    "media_type": null,
    "media_name": null,
    "created_at": "2026-08-16T12:00:00.000Z"
  }
}
```

Rules:

- Either `body` or media fields are required; message body is capped at 4000 characters.
- Blocked customers (`customer_profiles.is_blocked`) cannot send messages (`403`).
- Sending to an existing `thread_id` the customer isn't a member of returns `403`.
- Inserting a message triggers notifications to every other thread member (owner and/or customer), covered by the same trigger regardless of which side sent the message.
- `sender_name` is set automatically by the server (the customer's saved `customer_web_sessions.customer_name` for customer messages, the owner's `station_owners.owner_name` for owner messages inserted directly via RLS) — clients don't provide it. Useful for group threads with multiple owners/customers, where `sender_id` alone isn't human-readable.

### `customer-list-chat-threads`

Lists every thread (direct and group) the customer is a member of.

```http
POST /functions/v1/customer-list-chat-threads
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
  "threads": [
    {
      "id": "uuid",
      "kind": "direct",
      "station_id": "uuid",
      "title": "Washlly",
      "last_message_at": "2026-08-16T12:00:00.000Z",
      "unread_count": 2
    }
  ]
}
```

`title` is the station name for `direct` threads or the group name for `group` threads. `station_id` is only present for `direct` threads.

### `customer-get-chat-messages`

Returns message history for one thread (most recent 100, ascending order) and marks incoming messages as read.

```http
POST /functions/v1/customer-get-chat-messages
```

Request:

```json
{
  "customer_phone": "07736635435",
  "session_token": "customer-session-token",
  "thread_id": "uuid"
}
```

Success:

```json
{
  "success": true,
  "messages": [
    {
      "id": "uuid",
      "thread_id": "uuid",
      "sender_type": "owner",
      "sender_id": "auth-user-uuid",
      "sender_name": "Washlly",
      "body": "نعم متوفرة",
      "media_key": null,
      "media_url": null,
      "media_type": null,
      "media_name": null,
      "created_at": "2026-08-16T12:01:00.000Z",
      "read_at": "2026-08-16T12:02:00.000Z"
    }
  ]
}
```

Returns `403` if the customer isn't a member of the thread.

### `chat-media`

Netlify Edge Function for chat attachments (not a Supabase function — served from the website's own origin). Mirrors `offer-media` but with dual authentication and per-thread authorization.

```http
{{baseUrl}}/api/chat-media
```

- **Owner/admin side**: `Authorization: Bearer <SUPABASE_JWT>`, checked against `chat_thread_members` for the given thread via RLS.
- **Customer side**: `X-Customer-Phone` and `X-Customer-Session-Token` headers, checked against `customer_web_sessions` and `chat_thread_members`.
- Reads (`GET`) are public (content-addressed, unguessable keys); uploads and deletes require the auth above.

#### `POST /api/chat-media` — upload a file

```http
POST /api/chat-media
X-Thread-Id: <thread_uuid>
Content-Type: <image/* or video/*>
X-File-Name: <url-encoded original file name>
```

Plus either the owner `Authorization` header or the customer headers above. Body: raw file bytes.

Success (`201 Created`):

```json
{
  "key": "9730c774.../image~jpeg/photo.jpg",
  "url": "https://washlly.com/api/chat-media/9730c774.../image~jpeg/photo.jpg",
  "name": "photo.jpg",
  "type": "image/jpeg"
}
```

Rules: `image/*`/`video/*` only, **25 MB** max (tighter than `offer-media`'s 100 MB). Returns `401 Unauthorized` if the caller isn't a member of `X-Thread-Id`.

#### `GET /api/chat-media/<key>` — fetch a stored file

Public, no auth required.

#### `DELETE /api/chat-media/<key>` — remove a stored file

Same auth as upload; the thread id embedded in the key is used to check membership.

### `notify-on-chat-message`

Internal only — not called directly by clients. A database trigger (`trg_notify_chat_message_edge_function`, fires on every `chat_messages` insert) calls this function, mirroring `notify-on-booking-change`. It notifies every thread member except the sender: owners get a `notifications` row plus FCM push (`role: "owner"`), customers get a `customer_notifications` row plus FCM push (`role: "customer"`).

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
- When `service_kind` is a specific service name, not `quick` or empty, only stations that offer a matching active service are included, and that matching service is used for the booking. When `service_kind` is omitted, empty, or `quick`, no service filtering is applied and the first active service per station is used.
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

### Station Credit and Suspension

Washlly uses `station_owners.free_requests_quota` as the unified remaining request counter shown in the owner app/portal.

Lifecycle:

1. Owner registration creates the station with `stations.is_active = true` and `station_owners.free_requests_quota = 20` by default.
2. `create-map-booking` consumes one request from the selected station.
3. `create-quick-booking` consumes one request from each targeted station, up to the nearest eligible 3 stations.
4. Each consumed request decrements `station_owners.free_requests_quota` by `1` and increments `free_requests_used` for audit/history.
5. When `free_requests_quota` reaches `0`, the station is updated to:

```json
{
  "is_active": false,
  "suspension_reason": "free_quota_exhausted",
  "suspended_at": "timestamp"
}
```

6. Inactive stations are excluded from customer map and quick-booking station queries because all public station queries filter by `stations.is_active = true`.
7. When quota reaches zero, the backend calls `send-suspension-notice` for the station owner. If the internal function call is unavailable, it falls back to a WhatsApp text notice.
8. On successful package payment, `payment-callback` adds the package request count to `station_owners.free_requests_quota`, clears `outstanding_debt`, and reactivates the station.
9. `check-subscriptions` runs on schedule to expire old subscription rows and fix edge cases where a station still appears active while `free_requests_quota <= 0`.

Subscription top-up behavior:

| Package | Added to `free_requests_quota` |
|---|---:|
| `starter_20` | 20 |
| `growth_50` | 50 |
| `scale_110` | 110 |
| `unlimited_30` | Large operational credit; the active subscription is also tracked with `request_limit = null` |

Relevant columns:

| Table | Columns |
|---|---|
| `station_owners` | `free_requests_quota`, `free_requests_used`, `is_active`, `outstanding_debt`, `station_id` |
| `stations` | `is_active`, `suspension_reason`, `suspended_at` |
| `subscriptions` | `station_id`, `package_code`, `request_limit`, `requests_used`, `status`, `start_date`, `end_date`, `paid_at` |

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
| `customer_profiles` | Customer name, phone, city, blocked status |
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
| `offer_types` | Admin-managed offer type names such as Single or Slider |
| `offers` | Offer header records with comma-separated city targeting |
| `offer_details` | Ordered offer content, links, and optional station references |
| `chat_threads` | Direct (customer↔station) and admin-curated group chat threads |
| `chat_thread_members` | Chat thread membership, one row per owner (`user_id`) or customer (`customer_phone`) |
| `chat_messages` | Chat text/media messages, per thread |

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

Netlify site environment variables (required, separate from Supabase Edge Function secrets): the `offer-media` Netlify Edge Function used by Admin Offers needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` set under Netlify Site configuration → Environment variables to verify admin uploads. Without them it returns `401 Unauthorized` on every upload/delete because it falls back to using the caller's own session token, which Supabase's API gateway rejects. Redeploy the site after setting or changing these.

The `chat-media` Netlify Edge Function additionally needs `SUPABASE_SERVICE_ROLE_KEY` set under the same Netlify site environment variables, so it can validate customer session tokens for the customer-side upload path (customers have no Supabase Auth JWT for RLS to check, unlike owners/admins). Without it, customer-side chat media uploads fail with `401 Unauthorized`.

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
npx supabase functions deploy get-offers
npx supabase functions deploy customer-send-chat-message
npx supabase functions deploy customer-list-chat-threads
npx supabase functions deploy customer-get-chat-messages
npx supabase functions deploy notify-on-chat-message
```

The chat feature also requires the `SUPABASE_SERVICE_ROLE_KEY` Netlify site environment variable (in addition to `SUPABASE_URL`/`SUPABASE_PUBLISHABLE_KEY`) so `chat-media.ts` can validate customer sessions — see the note under "Deployment" above.

Deploy owner/admin/WhatsApp functions:

```bash
npx supabase functions deploy owner-self-register
npx supabase functions deploy owner-login-lookup
npx supabase functions deploy create-station-owner
npx supabase functions deploy delete-station-owner
npx supabase functions deploy create-employee
npx supabase functions deploy delete-employee
npx supabase functions deploy register-device-token
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
2. Call `customer-login-by-phone` with `customer_phone` and, on first use, `customer_name` and `customer_city`.
3. Store `customer_phone`, `customer_name`, `customer_city`, and `session_token` locally.
4. Use `customer-get-inbox` to render inbox, booking status, notification count, and bell sound trigger.
5. For regular booking, call `spin-booking-discount`, then `create-map-booking`.
6. For quick booking, call `create-quick-booking`; it targets the nearest eligible stations within 15 km in deterministic distance order.
7. For customer actions, call `customer-manage-booking`.
8. After a confirmed job is completed, call `customer-submit-rating`.
