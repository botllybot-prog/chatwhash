

# Store and Display WhatsApp Media Message Types

## Current State
- The `messages` table already has a `message_type` column (defaults to `'text'`).
- The webhook already stores `msg.type` (text, image, audio, document, etc.) in `message_type`.
- However, `content` only extracts `msg.text?.body` — for non-text messages, it falls back to the type name string, losing the media URL/caption.
- The UI only renders `msg.content` as plain text, with no visual distinction for media types.

## No DB changes needed — `message_type` column already exists.

## Changes

### 1. Update webhook to extract media metadata
**File**: `supabase/functions/whatsapp-webhook/index.ts`

For each message type, extract the relevant content:
- **text**: `msg.text.body` (already works)
- **image**: Store caption (`msg.image.caption`) as content, and media ID (`msg.image.id`) — we'll store a JSON string with `{media_id, caption, mime_type}` in `content` for media types
- **audio**: Store `{media_id, mime_type}` 
- **document**: Store `{media_id, filename, caption, mime_type}`
- **video**: Store `{media_id, caption, mime_type}`
- **sticker**: Store `{media_id, mime_type}`

Content format for non-text: JSON string like `{"media_id":"...","caption":"...","mime_type":"image/jpeg"}`

### 2. Add a media download helper in the webhook
Download media from WhatsApp API using the media ID and access token, then store it — or simply store the media ID for now and let the frontend display a placeholder with the type indicator.

**Simpler approach**: Store descriptive content + `message_type`, and show appropriate UI indicators. Media download can be added later.

For non-text messages, content will be:
- image: caption or "📷 صورة"
- audio: "🎵 رسالة صوتية"  
- video: caption or "🎥 فيديو"
- document: filename or "📄 مستند"
- sticker: "😊 ملصق"

### 3. Update the chat UI to show message type indicators
**File**: `src/pages/Conversations.tsx`

Add a `MessageContent` component that renders differently based on `message_type`:
- **text**: Current plain text rendering
- **image**: Show an image icon + caption text
- **audio**: Show audio icon + "رسالة صوتية"
- **document**: Show document icon + filename
- **video**: Show video icon + caption
- **sticker**: Show sticker indicator

Also show the message type in the conversation list preview.

## Technical Details

**Webhook content extraction:**
```typescript
let content = "";
switch (msg.type) {
  case "text": content = msg.text?.body || ""; break;
  case "image": content = msg.image?.caption || "📷 صورة"; break;
  case "audio": content = "🎵 رسالة صوتية"; break;
  case "video": content = msg.video?.caption || "🎥 فيديو"; break;
  case "document": content = msg.document?.filename || "📄 مستند"; break;
  case "sticker": content = "😊 ملصق"; break;
  default: content = msg.type || "";
}
```

**UI MessageContent component** will use icons from lucide-react (Image, Mic, FileText, Video) alongside the content text, with a subtle badge/indicator for the message type.

