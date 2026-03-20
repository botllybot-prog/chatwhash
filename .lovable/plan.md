

# خطة إصلاح خلل الإرسال والاستقبال المتكرر

## المشاكل المكتشفة

بعد فحص الكود، هناك عدة مشاكل تسبب الفشل عند الإرسال/الاستقبال المتكرر:

### 1. Race Condition في إنشاء المحادثات (webhook)
عند وصول رسالتين متزامنتين من نفس الرقم، كلتاهما تجد أنه لا توجد محادثة مفتوحة فتحاول كل منهما إنشاء محادثة جديدة، مما يسبب تكرار أو أخطاء.

### 2. عدم وجود حماية من تكرار الرسائل (Duplicate Messages)
Meta ترسل نفس الـ webhook أكثر من مرة أحياناً. لا يوجد فحص لتجنب إدخال رسالة بنفس `whatsapp_message_id` مرتين.

### 3. عدم معالجة أخطاء DB بشكل صحيح
الـ webhook يبتلع الأخطاء بصمت (`catch` فارغ)، فلا نعرف السبب الحقيقي للفشل.

### 4. الـ Realtime Channels في الواجهة
عند تغيير المحادثة بسرعة، قد تتراكم القنوات القديمة ولا يتم تنظيفها بشكل صحيح.

### 5. عدم وجود unique constraint على whatsapp_message_id
إدخال نفس الرسالة مرتين يمر بدون خطأ مما يسبب تكرار الرسائل.

---

## خطوات الإصلاح

### الخطوة 1: Migration لإضافة unique constraint
- إضافة `UNIQUE` constraint على `messages.whatsapp_message_id` (مع استثناء NULL)
- إضافة unique composite index على `conversations(customer_phone, status)` لمنع محادثات مكررة

### الخطوة 2: إعادة كتابة whatsapp-webhook
- استخدام `ON CONFLICT` (upsert) عند إنشاء المحادثة لتجنب race condition
- استخدام `ON CONFLICT DO NOTHING` عند إدراج الرسالة لتجنب التكرار
- إضافة logging تفصيلي لكل خطوة
- إرجاع 200 دائماً لـ Meta (حتى مع أخطاء داخلية) لمنع إعادة المحاولات

### الخطوة 3: إصلاح whatsapp-send
- إضافة try-catch أفضل مع تفاصيل الخطأ
- التحقق من وجود المحادثة قبل الإرسال

### الخطوة 4: إصلاح Realtime في الواجهة (Conversations.tsx)
- استخدام unique channel names مع timestamp لتجنب تضارب القنوات
- إضافة cleanup أفضل للقنوات عند تغيير المحادثة

---

## التفاصيل التقنية

**Migration SQL:**
```sql
-- Unique partial index on whatsapp_message_id (excluding nulls)
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_wa_id_unique 
ON public.messages(whatsapp_message_id) WHERE whatsapp_message_id IS NOT NULL;

-- Unique composite to prevent duplicate open conversations
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_phone_status_unique 
ON public.conversations(customer_phone, status) WHERE status = 'open';
```

**Webhook upsert pattern:**
```typescript
// Find or create conversation atomically
const { data: conv } = await supabase
  .from("conversations")
  .upsert(
    { customer_phone: phone, customer_name: contactName, status: "open", last_message_at: now },
    { onConflict: "customer_phone,status", ignoreDuplicates: false }
  )
  .select("id")
  .single();

// Insert message, skip if duplicate
const { error: msgError } = await supabase
  .from("messages")
  .upsert(
    { conversation_id: conv.id, direction: "inbound", content, ... , whatsapp_message_id: msg.id },
    { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
  );
```

