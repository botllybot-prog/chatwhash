

# خطة: نظام حسابات أصحاب المحطات مع طلبات التعديل وموافقة الأدمن

## ملخص
إنشاء نظام متعدد الأدوار يتيح للأدمن إنشاء حسابات لأصحاب المحطات، ولكل صاحب محطة لوحة خاصة تعرض بيانات محطته وحجوزاتها، مع نظام طلبات تعديل تحتاج موافقة الأدمن، وإشعارات داخل التطبيق وعبر واتساب.

## هيكل النظام

```text
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   أدمن          │     │  صاحب محطة           │     │  واتساب         │
│  /bot-admin     │────▶│  /station-portal      │────▶│  إشعارات        │
│  - إدارة كاملة  │     │  - عرض حجوزات        │     │  حجز جديد       │
│  - إنشاء حسابات│     │  - طلب تعديل         │     └─────────────────┘
│  - موافقة طلبات │     │  - إشعارات           │
└─────────────────┘     └──────────────────────┘
```

---

## 1. قاعدة البيانات (Migration)

### جداول جديدة:

**`user_roles`** — أدوار المستخدمين (admin / station_owner)
- `id`, `user_id` (FK auth.users), `role` (enum: admin, station_owner), unique(user_id, role)

**`station_owners`** — ربط صاحب المحطة بمحطته
- `id`, `user_id` (FK auth.users), `station_id` (FK stations), `owner_name`, `owner_phone`, `created_at`

**`edit_requests`** — طلبات التعديل المعلقة
- `id`, `station_id`, `requested_by` (FK auth.users), `field_name`, `old_value`, `new_value`, `status` (enum: pending, approved, rejected), `admin_note`, `created_at`, `reviewed_at`

**`notifications`** — إشعارات داخل التطبيق
- `id`, `user_id`, `title`, `body`, `is_read`, `type` (booking, edit_request, etc.), `reference_id`, `created_at`

### تعديلات:
- إضافة `owner_id` (nullable) إلى جدول `stations`

### Enums جديدة:
- `app_role`: admin, station_owner
- `edit_request_status`: pending, approved, rejected

### دالة أمان:
- `has_role(user_id, role)` — SECURITY DEFINER لفحص الدور بدون تكرار RLS

### سياسات RLS:
- `stations`: المالك يقرأ محطته فقط، الأدمن يقرأ/يعدل الكل
- `bookings`: المالك يقرأ حجوزات محطته فقط
- `services`: المالك يقرأ خدمات محطته فقط
- `edit_requests`: المالك يُنشئ ويقرأ طلباته، الأدمن يقرأ/يعدل الكل
- `notifications`: كل مستخدم يقرأ إشعاراته فقط

---

## 2. صفحات جديدة

### `/station-portal` — لوحة صاحب المحطة
- **معلومات المحطة**: عرض فقط (الاسم، العنوان، الصورة، ساعات العمل، نوع المواعيد، الحالة)
- **طلب تعديل**: زر بجانب كل حقل يفتح نافذة لإدخال القيمة الجديدة → يُنشئ سجل في `edit_requests`
- **الخدمات**: عرض خدمات المحطة (قراءة فقط) مع إمكانية طلب تعديل
- **الحجوزات**: جدول حجوزات المحطة مع فلترة بالحالة والتاريخ
- **الإشعارات**: جرس إشعارات يعرض الحجوزات الجديدة وحالة طلبات التعديل

### تبويب جديد في `/bot-admin` — إدارة الحسابات
- **إنشاء حساب صاحب محطة**: إدخال الاسم، البريد، كلمة المرور، اختيار المحطة → إنشاء مستخدم عبر Edge Function (service_role)
- **عرض/تعديل/حذف الحسابات** الموجودة
- **طلبات التعديل**: عرض الطلبات المعلقة مع أزرار موافقة/رفض → عند الموافقة يُطبق التعديل على الجدول الأصلي

---

## 3. Edge Functions

### `create-station-owner` (جديدة)
- تُنشئ مستخدم في auth.users عبر admin API
- تُضيف دور station_owner في user_roles
- تُضيف سجل في station_owners

### `notify-station-owner` (جديدة)
- تُرسل إشعار واتساب لصاحب المحطة عند حجز جديد
- تستخدم قالب واتساب مُعد مسبقاً
- تُستدعى من webhook عند إتمام حجز

---

## 4. تعديل AuthGuard والتوجيه
- فحص دور المستخدم بعد تسجيل الدخول
- `admin` → توجيه إلى `/bot-admin`
- `station_owner` → توجيه إلى `/station-portal`
- حماية المسارات حسب الدور

---

## 5. تعديل webhook الحجز
- عند إتمام حجز جديد: إنشاء إشعار في جدول `notifications` + استدعاء `notify-station-owner` لإرسال رسالة واتساب

---

## التفاصيل التقنية

**الملفات المتأثرة:**
- `supabase/migrations/` — migration جديد (جداول + enums + RLS + دالة has_role)
- `supabase/functions/create-station-owner/index.ts` — جديد
- `supabase/functions/notify-station-owner/index.ts` — جديد
- `supabase/functions/whatsapp-webhook/index.ts` — إضافة إشعار عند الحجز
- `supabase/config.toml` — إضافة الدوال الجديدة
- `src/pages/StationPortal.tsx` — صفحة جديدة
- `src/pages/BotAdmin.tsx` — تبويبات جديدة (حسابات + طلبات تعديل)
- `src/components/AuthGuard.tsx` — فحص الدور والتوجيه
- `src/App.tsx` — مسار `/station-portal`

