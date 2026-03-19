

# خطة تنفيذ ربط WhatsApp Business API

## ملخص
بناء نظام متكامل لدعم العملاء عبر واتساب بزنس يشمل: قاعدة بيانات للمحادثات والرسائل، Edge Functions للـ Webhook والإرسال، وواجهة بسيطة لإدارة المحادثات.

## المتطلبات المسبقة (يقوم بها المستخدم)
قبل أن يعمل النظام، ستحتاج لإضافة 4 مفاتيح سرية من حساب Meta Business:
- **WHATSAPP_ACCESS_TOKEN** - من Meta for Developers
- **WHATSAPP_PHONE_NUMBER_ID** - معرّف رقم الهاتف
- **WHATSAPP_VERIFY_TOKEN** - رمز تحقق تختاره أنت
- **WHATSAPP_APP_SECRET** - من إعدادات التطبيق في Meta

---

## الخطوات

### الخطوة 1: إنشاء قاعدة البيانات
Migration تشمل:
- جدول **conversations**: `id`, `customer_phone`, `customer_name`, `status` (open/closed), `last_message_at`, `created_at`
- جدول **messages**: `id`, `conversation_id` (FK), `direction` (inbound/outbound), `content`, `message_type` (text/image/etc), `whatsapp_message_id`, `status` (sent/delivered/read), `created_at`
- RLS policies للقراءة والكتابة (مفتوحة مبدئياً - بدون auth حالياً)
- Index على `customer_phone` و `conversation_id`

### الخطوة 2: إضافة المفاتيح السرية
طلب إضافة الـ 4 secrets المذكورة أعلاه عبر أداة add_secret.

### الخطوة 3: Edge Function - whatsapp-webhook
- **GET**: التحقق من Webhook (Verification Challenge) باستخدام `WHATSAPP_VERIFY_TOKEN`
- **POST**: استقبال الرسائل الواردة + التحقق من `X-Hub-Signature-256` باستخدام `WHATSAPP_APP_SECRET`
- حفظ الرسائل في قاعدة البيانات (إنشاء محادثة جديدة أو إضافة لمحادثة موجودة)
- معالجة حالات التسليم (delivery status updates)
- بدون JWT verification (webhook خارجي)

### الخطوة 4: Edge Function - whatsapp-send
- إرسال رسائل نصية عبر WhatsApp Cloud API
- تحديث قاعدة البيانات بالرسالة المُرسلة
- يتطلب authorization header (للحماية من الاستخدام غير المصرح)

### الخطوة 5: واجهة المستخدم
- **صفحة `/conversations`** - لوحة بسيطة بتصميم chat:
  - **الجانب الأيسر**: قائمة المحادثات (اسم/رقم العميل + آخر رسالة + الوقت)
  - **الجانب الأيمن**: نافذة الدردشة مع العميل المحدد
  - حقل إرسال رد في الأسفل
  - مؤشرات حالة الرسالة (مُرسلة ✓، مُستلمة ✓✓، مقروءة ✓✓ أزرق)
- تحديث تلقائي باستخدام Supabase Realtime

### الخطوة 6: تحديث الراوتر
- إضافة route `/conversations` في App.tsx
- جعل الصفحة الرئيسية تحوّل للمحادثات

---

## بعد التنفيذ
ستحتاج لتسجيل رابط الـ Webhook في Meta for Developers:
```text
URL: https://snnajdsrvufjynzblkmd.supabase.co/functions/v1/whatsapp-webhook
Verify Token: (القيمة التي تختارها)
```

---

## التفاصيل التقنية

```text
┌─────────────┐     POST      ┌──────────────────┐     INSERT     ┌──────────┐
│  WhatsApp   │ ────────────► │ whatsapp-webhook  │ ────────────► │ Supabase │
│  (Meta)     │               │  (Edge Function)  │               │    DB    │
└─────────────┘               └──────────────────┘               └──────────┘
       ▲                                                              │
       │          POST        ┌──────────────────┐    Realtime        │
       │ ◄─────────────────── │  whatsapp-send   │ ◄─────────────────┘
       │                      │  (Edge Function)  │                   │
       │                      └──────────────────┘                   ▼
       │                             ▲                        ┌──────────┐
       │                             │ invoke                 │ Frontend │
       └─────────────────────────────┼────────────────────────│  (React) │
                                     └────────────────────────└──────────┘
```

