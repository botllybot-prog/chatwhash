

# خطة تحويل التبويبات إلى صفحات مستقلة مع إعدادات بوت متقدمة

## الهيكل الجديد

بدلاً من صفحة واحدة `BotAdmin.tsx` بتبويبات، سيكون لكل قسم صفحة مستقلة مع **Sidebar** للتنقل بين الصفحات.

```text
/app/admin/stations       → المحطات
/app/admin/services       → الخدمات
/app/admin/bookings       → الحجوزات
/app/admin/owners         → الحسابات
/app/admin/edit-requests  → طلبات التعديل
/app/admin/subscriptions  → الاشتراكات
/app/admin/reports        → التقارير
/app/admin/settings       → الإعدادات (بوت + واتساب مدمجة)
```

## التفاصيل التقنية

### 1. إنشاء Layout مع Sidebar
- إنشاء `src/components/admin/AdminLayout.tsx` يحتوي على `SidebarProvider` + `Sidebar` مع روابط لكل صفحة
- تصميم Sidebar بألوان Ocean المستخدمة، مع أيقونات لكل قسم
- دعم الطي (collapse) على الموبايل

### 2. تحويل كل تبويب لصفحة مستقلة
نقل المكونات الموجودة داخل `BotAdmin.tsx` (ServicesTab, BookingsTab, BotSettingsTab) إلى ملفات مستقلة في `src/pages/admin/`:
- `src/pages/admin/AdminStations.tsx` → يستخدم StationsTab الموجود
- `src/pages/admin/AdminServices.tsx` → نقل ServicesTab
- `src/pages/admin/AdminBookings.tsx` → نقل BookingsTab  
- `src/pages/admin/AdminOwners.tsx` → يستخدم OwnersTab الموجود
- `src/pages/admin/AdminEditRequests.tsx` → يستخدم EditRequestsTab الموجود
- `src/pages/admin/AdminSubscriptions.tsx` → يستخدم SubscriptionsTab الموجود
- `src/pages/admin/AdminReports.tsx` → يستخدم ReportsTab الموجود
- `src/pages/admin/AdminSettings.tsx` → إعدادات متقدمة (جديد)

### 3. إعدادات البوت المتقدمة (الصفحة الجديدة)
دمج إعدادات واتساب (من Settings.tsx الحالي) + إعدادات البوت في صفحة واحدة بأقسام:

**قسم 1: إعدادات البوت الأساسية**
- تفعيل/تعطيل البوت
- رسالة الترحيب (textarea مع متغيرات)
- رسالة عند عدم الفهم
- رسالة تأكيد الحجز (مع متغيرات: {station}, {service}, {time}, {date}, {booking_number})
- رسالة إلغاء الحجز

**قسم 2: إعدادات التذكير**
- تفعيل/تعطيل التذكير
- وقت التذكير قبل الموعد (1 ساعة / 2 ساعة / يوم)
- رسالة التذكير (textarea مع متغيرات)

**قسم 3: إعدادات الردود التلقائية**
- رسالة خارج ساعات العمل
- رسالة عند امتلاء المواعيد
- رسالة بعد اكتمال الحجز (شكر)
- تفعيل/تعطيل كل رسالة

**قسم 4: ربط واتساب (من Settings.tsx)**
- Access Token, Phone Number ID, Verify Token, App Secret
- رابط Webhook

### 4. تحديث الراوتر
```text
/app/admin/*  → AdminLayout wrapping nested Routes
```
- تحديث AuthGuard لتوجيه الأدمن إلى `/app/admin/stations` بدل `/app/bot-admin`
- تحديث Login.tsx للتوجيه الصحيح
- حذف صفحة Settings.tsx القديمة (مدمجة في إعدادات الأدمن)

### 5. إضافة app_settings keys جديدة
مفاتيح إعدادات جديدة في `app_settings`:
- `BOT_UNKNOWN_MESSAGE` — رسالة عدم الفهم
- `BOT_CONFIRMATION_MESSAGE` — رسالة تأكيد الحجز
- `BOT_CANCELLATION_MESSAGE` — رسالة الإلغاء
- `BOT_AFTER_HOURS_MESSAGE` — رسالة خارج العمل
- `BOT_FULLY_BOOKED_MESSAGE` — رسالة امتلاء المواعيد
- `BOT_THANK_YOU_MESSAGE` — رسالة الشكر
- `REMINDER_HOURS_BEFORE` — عدد الساعات قبل التذكير
- `BOT_AFTER_HOURS_ENABLED` — تفعيل رسالة خارج العمل
- `BOT_THANK_YOU_ENABLED` — تفعيل رسالة الشكر

## الملفات المتأثرة

**جديدة:**
- `src/components/admin/AdminLayout.tsx`
- `src/components/admin/AdminSidebar.tsx`
- `src/pages/admin/AdminStations.tsx`
- `src/pages/admin/AdminServices.tsx`
- `src/pages/admin/AdminBookings.tsx`
- `src/pages/admin/AdminOwners.tsx`
- `src/pages/admin/AdminEditRequests.tsx`
- `src/pages/admin/AdminSubscriptions.tsx`
- `src/pages/admin/AdminReports.tsx`
- `src/pages/admin/AdminSettings.tsx`

**معدّلة:**
- `src/App.tsx` — تحديث الراوتر
- `src/components/AuthGuard.tsx` — تحديث التوجيه
- `src/pages/Login.tsx` — تحديث التوجيه
- `src/pages/Conversations.tsx` — تحديث رابط الإعدادات

**تُحذف:**
- `src/pages/BotAdmin.tsx` (استُبدلت بصفحات مستقلة)
- `src/pages/Settings.tsx` (دُمجت في AdminSettings)

