import type { AppLanguage } from "@/lib/language";

export const OFFER_CITY_VALUES = [
  "All",
  "Baghdad",
  "Erbil",
  "Basra",
  "Mosul",
  "Sulaymaniyah",
  "Kirkuk",
  "Karbala",
  "Najaf",
  "Duhok",
  "Ramadi",
  "Tikrit",
  "Nasiriyah",
  "Amarah",
  "Diwaniyah",
  "Kut",
  "Samawah",
  "Hilla",
  "Fallujah",
  "Baqubah",
] as const;

export const URL_TYPE_VALUES = ["Inside", "Outside", "None"] as const;

type OfferTextBundle = {
  offerTypes: {
    title: string;
    subtitle: string;
    search: string;
    add: string;
    edit: string;
    delete: string;
    name: string;
    id: string;
    actions: string;
    noRows: string;
    noMatches: string;
    addTitle: string;
    editTitle: string;
    formDesc: string;
    namePlaceholder: string;
    save: string;
    update: string;
    cancel: string;
    required: string;
    added: string;
    updated: string;
    deleted: string;
    loadError: string;
    saveError: string;
    deleteError: string;
    confirmTitle: string;
    confirmBody: string;
    confirmDelete: string;
    loading: string;
    count: string;
  };
  offers: {
    management: string;
    subtitle: string;
    createOffer: string;
    editOffer: string;
    save: string;
    cancel: string;
    delete: string;
    addOfferDetails: string;
    title: string;
    type: string;
    cities: string;
    body: string;
    urlType: string;
    url: string;
    station: string;
    sortOrder: string;
    actions: string;
    details: string;
    offerList: string;
    search: string;
    noOffers: string;
    selectOffer: string;
    newOffer: string;
    detailTitle: string;
    file: string;
    chooseFile: string;
    selectedFile: string;
    noFile: string;
    mediaReview: string;
    mediaImage: string;
    mediaVideo: string;
    mediaPending: string;
    mediaStored: string;
    removeFile: string;
    invalidMediaType: string;
    mediaTooLarge: string;
    mediaHint: string;
    mediaStorageTitle: string;
    mediaStorageBody: string;
    moveUp: string;
    moveDown: string;
    removeDetail: string;
    singleHint: string;
    sliderHint: string;
    titlePlaceholder: string;
    detailTitlePlaceholder: string;
    bodyPlaceholder: string;
    urlPlaceholder: string;
    stationPlaceholder: string;
    citiesPlaceholder: string;
    typePlaceholder: string;
    loading: string;
    requiredTitle: string;
    requiredType: string;
    requiredCities: string;
    requiredDetails: string;
    saved: string;
    deleted: string;
    loadError: string;
    saveError: string;
    deleteError: string;
    confirmDeleteTitle: string;
    confirmDeleteBody: string;
    confirmDelete: string;
    all: string;
    single: string;
    slider: string;
    inside: string;
    outside: string;
    none: string;
  };
  sidebar: {
    offers: string;
    offerTypes: string;
  };
  cities: Record<(typeof OFFER_CITY_VALUES)[number], string>;
};

export const adminOffersTexts: Record<AppLanguage, OfferTextBundle> = {
  ar: {
    offerTypes: {
      title: "أنواع العروض",
      subtitle: "إدارة التصنيفات الرئيسية التي ترتبط بها العروض.",
      search: "ابحث باسم نوع العرض...",
      add: "إضافة نوع عرض",
      edit: "تعديل",
      delete: "حذف",
      name: "اسم النوع",
      id: "المعرف",
      actions: "إجراءات",
      noRows: "لا توجد أنواع عروض حالياً.",
      noMatches: "لا توجد نتائج مطابقة للبحث.",
      addTitle: "إضافة نوع عرض جديد",
      editTitle: "تعديل نوع العرض",
      formDesc: "أدخل اسماً واضحاً لنوع العرض حتى يظهر ضمن إدارة العروض.",
      namePlaceholder: "مثال: عروض موسمية",
      save: "حفظ",
      update: "تحديث",
      cancel: "إلغاء",
      required: "اسم نوع العرض مطلوب",
      added: "تمت إضافة نوع العرض",
      updated: "تم تحديث نوع العرض",
      deleted: "تم حذف نوع العرض",
      loadError: "تعذر تحميل أنواع العروض",
      saveError: "تعذر حفظ نوع العرض",
      deleteError: "تعذر حذف نوع العرض",
      confirmTitle: "حذف نوع العرض؟",
      confirmBody: "سيتم حذف هذا النوع وأي عروض مرتبطة به بسبب علاقة الحذف التلقائي.",
      confirmDelete: "حذف",
      loading: "جاري التحميل...",
      count: "العدد",
    },
    offers: {
      management: "إدارة العروض",
      subtitle: "أنشئ عروضاً مفردة أو سلايدر وحدد المدن وتفاصيل كل عرض.",
      createOffer: "إنشاء عرض",
      editOffer: "تعديل العرض",
      save: "حفظ",
      cancel: "إلغاء",
      delete: "حذف",
      addOfferDetails: "إضافة تفاصيل العرض",
      title: "العنوان",
      type: "النوع",
      cities: "المدن",
      body: "التفاصيل",
      urlType: "نوع الرابط",
      url: "الرابط",
      station: "المحطة",
      sortOrder: "الترتيب",
      actions: "إجراءات",
      details: "تفاصيل العرض",
      offerList: "قائمة العروض",
      search: "ابحث في العروض...",
      noOffers: "لا توجد عروض حالياً.",
      selectOffer: "اختر عرضاً من القائمة للتعديل.",
      newOffer: "عرض جديد",
      detailTitle: "عنوان التفاصيل",
      file: "ملف",
      chooseFile: "اختيار ملف",
      selectedFile: "الملف المختار",
      noFile: "لا يوجد ملف",
      mediaReview: "مراجعة الملف المرفوع",
      mediaImage: "صورة",
      mediaVideo: "فيديو",
      mediaPending: "بانتظار الحفظ",
      mediaStored: "ملف محفوظ",
      removeFile: "إزالة الملف",
      invalidMediaType: "يُسمح برفع ملفات الصور أو الفيديو فقط.",
      mediaTooLarge: "حجم الملف يتجاوز الحد الأقصى 100 ميغابايت.",
      mediaHint: "صور أو فيديو فقط، بحد أقصى 100 ميغابايت.",
      mediaStorageTitle: "تعذّر حفظ الملفات",
      mediaStorageBody:
        "أعمدة الوسائط غير موجودة في قاعدة البيانات، لذلك لا يمكن حفظ الصور أو الفيديو بعد. نفّذ الترحيل المعلّق supabase/migrations/20260730090000_add_offer_detail_media.sql ثم أعد المحاولة. تُحفظ بقية حقول العرض بشكل طبيعي.",
      moveUp: "تحريك للأعلى",
      moveDown: "تحريك للأسفل",
      removeDetail: "حذف التفاصيل",
      singleHint: "نوع مفرد: يتم الاحتفاظ بتفصيل واحد فقط.",
      sliderHint: "نوع سلايدر: يمكنك إضافة أكثر من تفصيل وترتيبها.",
      titlePlaceholder: "مثال: عرض نهاية الأسبوع",
      detailTitlePlaceholder: "مثال: خصم خاص",
      bodyPlaceholder: "اكتب تفاصيل العرض...",
      urlPlaceholder: "https://example.com",
      stationPlaceholder: "اختر محطة",
      citiesPlaceholder: "اختر المدن",
      typePlaceholder: "اختر النوع",
      loading: "جاري التحميل...",
      requiredTitle: "عنوان العرض مطلوب",
      requiredType: "نوع العرض مطلوب",
      requiredCities: "اختر مدينة واحدة على الأقل",
      requiredDetails: "أضف تفصيلاً واحداً على الأقل",
      saved: "تم حفظ العرض",
      deleted: "تم حذف العرض",
      loadError: "تعذر تحميل العروض",
      saveError: "تعذر حفظ العرض",
      deleteError: "تعذر حذف العرض",
      confirmDeleteTitle: "حذف العرض؟",
      confirmDeleteBody: "سيتم حذف العرض وكل تفاصيله.",
      confirmDelete: "حذف",
      all: "الكل",
      single: "مفرد",
      slider: "شريحة",
      inside: "داخلي",
      outside: "خارجي",
      none: "بدون",
    },
    sidebar: {
      offers: "العروض",
      offerTypes: "أنواع العروض",
    },
    cities: {
      All: "الكل",
      Baghdad: "بغداد",
      Erbil: "أربيل",
      Basra: "البصرة",
      Mosul: "الموصل",
      Sulaymaniyah: "السليمانية",
      Kirkuk: "كركوك",
      Karbala: "كربلاء",
      Najaf: "النجف",
      Duhok: "دهوك",
      Ramadi: "الرمادي",
      Tikrit: "تكريت",
      Nasiriyah: "الناصرية",
      Amarah: "العمارة",
      Diwaniyah: "الديوانية",
      Kut: "الكوت",
      Samawah: "السماوة",
      Hilla: "الحلة",
      Fallujah: "الفلوجة",
      Baqubah: "بعقوبة",
    },
  },
  en: {
    offerTypes: {
      title: "Offer types",
      subtitle: "Manage the primary categories used by offers.",
      search: "Search offer type name...",
      add: "Add New Offer Type",
      edit: "Edit",
      delete: "Delete",
      name: "Name",
      id: "ID",
      actions: "Actions",
      noRows: "No offer types yet.",
      noMatches: "No matching offer types.",
      addTitle: "Add new offer type",
      editTitle: "Edit offer type",
      formDesc: "Enter a clear type name to use in offers management.",
      namePlaceholder: "Example: Seasonal offers",
      save: "Save",
      update: "Update",
      cancel: "Cancel",
      required: "Offer type name is required",
      added: "Offer type added",
      updated: "Offer type updated",
      deleted: "Offer type deleted",
      loadError: "Unable to load offer types",
      saveError: "Unable to save offer type",
      deleteError: "Unable to delete offer type",
      confirmTitle: "Delete offer type?",
      confirmBody: "This will delete the type and any linked offers because of the cascade relationship.",
      confirmDelete: "Delete",
      loading: "Loading...",
      count: "Count",
    },
    offers: {
      management: "Offers Management",
      subtitle: "Create single or slider offers, then assign cities and details.",
      createOffer: "Create Offer",
      editOffer: "Edit Offer",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      addOfferDetails: "Add Offer Details",
      title: "Title",
      type: "Type",
      cities: "Cities",
      body: "Body",
      urlType: "URL Type",
      url: "URL",
      station: "Station",
      sortOrder: "Sort Order",
      actions: "Actions",
      details: "Offer Details",
      offerList: "Offers List",
      search: "Search offers...",
      noOffers: "No offers yet.",
      selectOffer: "Select an offer from the list to edit it.",
      newOffer: "New Offer",
      detailTitle: "Detail Title",
      file: "File",
      chooseFile: "Choose File",
      selectedFile: "Selected file",
      noFile: "No file",
      mediaReview: "Uploaded file review",
      mediaImage: "Image",
      mediaVideo: "Video",
      mediaPending: "Pending — uploads when you save",
      mediaStored: "Stored file",
      removeFile: "Remove file",
      invalidMediaType: "Only image or video files can be uploaded.",
      mediaTooLarge: "File exceeds the 100 MB limit.",
      mediaHint: "Images or videos only, up to 100 MB.",
      mediaStorageTitle: "Media uploads are unavailable",
      mediaStorageBody:
        "The offer media columns are missing from the database, so images and videos cannot be stored yet. Apply the pending migration supabase/migrations/20260730090000_add_offer_detail_media.sql and try again. Every other offer field still saves normally.",
      moveUp: "Move up",
      moveDown: "Move down",
      removeDetail: "Remove detail",
      singleHint: "Single type: exactly one detail section is kept.",
      sliderHint: "Slider type: add multiple details and reorder them.",
      titlePlaceholder: "Example: Weekend offer",
      detailTitlePlaceholder: "Example: Special discount",
      bodyPlaceholder: "Write offer details...",
      urlPlaceholder: "https://example.com",
      stationPlaceholder: "Select station",
      citiesPlaceholder: "Select cities",
      typePlaceholder: "Select type",
      loading: "Loading...",
      requiredTitle: "Offer title is required",
      requiredType: "Offer type is required",
      requiredCities: "Select at least one city",
      requiredDetails: "Add at least one detail",
      saved: "Offer saved",
      deleted: "Offer deleted",
      loadError: "Unable to load offers",
      saveError: "Unable to save offer",
      deleteError: "Unable to delete offer",
      confirmDeleteTitle: "Delete offer?",
      confirmDeleteBody: "This will delete the offer and all of its details.",
      confirmDelete: "Delete",
      all: "All",
      single: "Single",
      slider: "Slider",
      inside: "Inside",
      outside: "Outside",
      none: "None",
    },
    sidebar: {
      offers: "Offers",
      offerTypes: "Offer types",
    },
    cities: {
      All: "All",
      Baghdad: "Baghdad",
      Erbil: "Erbil",
      Basra: "Basra",
      Mosul: "Mosul",
      Sulaymaniyah: "Sulaymaniyah",
      Kirkuk: "Kirkuk",
      Karbala: "Karbala",
      Najaf: "Najaf",
      Duhok: "Duhok",
      Ramadi: "Ramadi",
      Tikrit: "Tikrit",
      Nasiriyah: "Nasiriyah",
      Amarah: "Amarah",
      Diwaniyah: "Diwaniyah",
      Kut: "Kut",
      Samawah: "Samawah",
      Hilla: "Hilla",
      Fallujah: "Fallujah",
      Baqubah: "Baqubah",
    },
  },
  ku: {
    offerTypes: {
      title: "جۆرەکانی ئۆفەر",
      subtitle: "جۆرە سەرەکییەکانی ئۆفەرەکان بەڕێوە ببە.",
      search: "گەڕان بە ناوی جۆری ئۆفەر...",
      add: "زیادکردنی جۆری ئۆفەر",
      edit: "دەستکاری",
      delete: "سڕینەوە",
      name: "ناو",
      id: "ناسنامە",
      actions: "کردارەکان",
      noRows: "هیچ جۆری ئۆفەرێک نییە.",
      noMatches: "هیچ ئەنجامێکی گونجاو نییە.",
      addTitle: "زیادکردنی جۆری ئۆفەری نوێ",
      editTitle: "دەستکاریکردنی جۆری ئۆفەر",
      formDesc: "ناوێکی ڕوون بنووسە بۆ بەکارهێنان لە بەڕێوەبردنی ئۆفەرەکان.",
      namePlaceholder: "نموونە: ئۆفەری وەرزی",
      save: "پاشەکەوتکردن",
      update: "نوێکردنەوە",
      cancel: "هەڵوەشاندنەوە",
      required: "ناوی جۆری ئۆفەر پێویستە",
      added: "جۆری ئۆفەر زیاد کرا",
      updated: "جۆری ئۆفەر نوێ کرایەوە",
      deleted: "جۆری ئۆفەر سڕایەوە",
      loadError: "بارکردنی جۆرەکانی ئۆفەر سەرکەوتوو نەبوو",
      saveError: "پاشەکەوتکردنی جۆری ئۆفەر سەرکەوتوو نەبوو",
      deleteError: "سڕینەوەی جۆری ئۆفەر سەرکەوتوو نەبوو",
      confirmTitle: "جۆری ئۆفەر بسڕدرێتەوە؟",
      confirmBody: "ئەم جۆرە و هەر ئۆفەرێکی پەیوەست پێوەیە دەسڕێتەوە.",
      confirmDelete: "سڕینەوە",
      loading: "باردەکرێت...",
      count: "ژمارە",
    },
    offers: {
      management: "بەڕێوەبردنی ئۆفەرەکان",
      subtitle: "ئۆفەری تاک یان سڵایدەر دروست بکە و شار و وردەکارییەکان دیاری بکە.",
      createOffer: "دروستکردنی ئۆفەر",
      editOffer: "دەستکاریکردنی ئۆفەر",
      save: "پاشەکەوتکردن",
      cancel: "هەڵوەشاندنەوە",
      delete: "سڕینەوە",
      addOfferDetails: "زیادکردنی وردەکارییەکانی ئۆفەر",
      title: "سەردێڕ",
      type: "جۆر",
      cities: "شارەکان",
      body: "ناوەڕۆک",
      urlType: "جۆری بەستەر",
      url: "بەستەر",
      station: "وێستگە",
      sortOrder: "ڕیزبەندی",
      actions: "کردارەکان",
      details: "وردەکارییەکانی ئۆفەر",
      offerList: "لیستی ئۆفەرەکان",
      search: "گەڕان لە ئۆفەرەکان...",
      noOffers: "هیچ ئۆفەرێک نییە.",
      selectOffer: "ئۆفەرێک لە لیستەکە هەڵبژێرە بۆ دەستکاری.",
      newOffer: "ئۆفەری نوێ",
      detailTitle: "سەردێڕی وردەکاری",
      file: "فایل",
      chooseFile: "هەڵبژاردنی فایل",
      selectedFile: "فایلی هەڵبژێردراو",
      noFile: "فایل نییە",
      mediaReview: "پێداچوونەوەی فایلی بارکراو",
      mediaImage: "وێنە",
      mediaVideo: "ڤیدیۆ",
      mediaPending: "چاوەڕوانی پاشەکەوتکردن",
      mediaStored: "فایلی پاشەکەوتکراو",
      removeFile: "سڕینەوەی فایل",
      invalidMediaType: "تەنها فایلی وێنە یان ڤیدیۆ دەتوانرێت بار بکرێت.",
      mediaTooLarge: "قەبارەی فایل لە سنووری ١٠٠ مێگابایت زیاترە.",
      mediaHint: "تەنها وێنە یان ڤیدیۆ، تا ١٠٠ مێگابایت.",
      mediaStorageTitle: "بارکردنی فایل بەردەست نییە",
      mediaStorageBody:
        "ستوونەکانی میدیا لە بنکەی دراوە بوونی نییە، بۆیە وێنە و ڤیدیۆ ناتوانرێت پاشەکەوت بکرێت. ترحیلی چاوەڕوانمان supabase/migrations/20260730090000_add_offer_detail_media.sql جێبەجێ بکە و دووبارە هەوڵ بدە. هەموو خانەکانی تری پێشکەش بە ئاسایی پاشەکەوت دەکرێن.",
      moveUp: "بردنە سەرەوە",
      moveDown: "بردنە خوارەوە",
      removeDetail: "سڕینەوەی وردەکاری",
      singleHint: "جۆری تاک: تەنها یەک بەشی وردەکاری دەمێنێتەوە.",
      sliderHint: "جۆری سڵایدەر: دەتوانیت چەند وردەکاری زیاد بکەیت و ڕیزیان بکەیت.",
      titlePlaceholder: "نموونە: ئۆفەری کۆتایی هەفتە",
      detailTitlePlaceholder: "نموونە: داشکاندنی تایبەت",
      bodyPlaceholder: "وردەکاری ئۆفەر بنووسە...",
      urlPlaceholder: "https://example.com",
      stationPlaceholder: "وێستگە هەڵبژێرە",
      citiesPlaceholder: "شارەکان هەڵبژێرە",
      typePlaceholder: "جۆر هەڵبژێرە",
      loading: "باردەکرێت...",
      requiredTitle: "سەردێڕی ئۆفەر پێویستە",
      requiredType: "جۆری ئۆفەر پێویستە",
      requiredCities: "لانیکەم یەک شار هەڵبژێرە",
      requiredDetails: "لانیکەم یەک وردەکاری زیاد بکە",
      saved: "ئۆفەر پاشەکەوت کرا",
      deleted: "ئۆفەر سڕایەوە",
      loadError: "بارکردنی ئۆفەرەکان سەرکەوتوو نەبوو",
      saveError: "پاشەکەوتکردنی ئۆفەر سەرکەوتوو نەبوو",
      deleteError: "سڕینەوەی ئۆفەر سەرکەوتوو نەبوو",
      confirmDeleteTitle: "ئۆفەر بسڕدرێتەوە؟",
      confirmDeleteBody: "ئەم ئۆفەرە و هەموو وردەکارییەکانی دەسڕێتەوە.",
      confirmDelete: "سڕینەوە",
      all: "هەمووی",
      single: "تاک",
      slider: "سڵایدەر",
      inside: "ناوەکی",
      outside: "دەرەکی",
      none: "هیچ",
    },
    sidebar: {
      offers: "ئۆفەرەکان",
      offerTypes: "جۆرەکانی ئۆفەر",
    },
    cities: {
      All: "هەمووی",
      Baghdad: "بەغدا",
      Erbil: "هەولێر",
      Basra: "بەسرە",
      Mosul: "مووسڵ",
      Sulaymaniyah: "سلێمانی",
      Kirkuk: "کەرکووک",
      Karbala: "کەربەلا",
      Najaf: "نەجەف",
      Duhok: "دهۆک",
      Ramadi: "ڕەمادی",
      Tikrit: "تکریت",
      Nasiriyah: "ناسیریە",
      Amarah: "عەمارە",
      Diwaniyah: "دیوانیە",
      Kut: "کوت",
      Samawah: "سەماوە",
      Hilla: "حیلە",
      Fallujah: "فەلووجە",
      Baqubah: "بەعقوبە",
    },
  },
  tr: {
    offerTypes: {
      title: "Teklif türleri",
      subtitle: "Tekliflerde kullanılan ana kategorileri yönetin.",
      search: "Teklif türü adına göre ara...",
      add: "Yeni teklif türü ekle",
      edit: "Düzenle",
      delete: "Sil",
      name: "Ad",
      id: "ID",
      actions: "İşlemler",
      noRows: "Henüz teklif türü yok.",
      noMatches: "Eşleşen teklif türü yok.",
      addTitle: "Yeni teklif türü ekle",
      editTitle: "Teklif türünü düzenle",
      formDesc: "Teklif yönetiminde kullanmak için açık bir tür adı girin.",
      namePlaceholder: "Örnek: Sezon teklifleri",
      save: "Kaydet",
      update: "Güncelle",
      cancel: "İptal",
      required: "Teklif türü adı gerekli",
      added: "Teklif türü eklendi",
      updated: "Teklif türü güncellendi",
      deleted: "Teklif türü silindi",
      loadError: "Teklif türleri yüklenemedi",
      saveError: "Teklif türü kaydedilemedi",
      deleteError: "Teklif türü silinemedi",
      confirmTitle: "Teklif türü silinsin mi?",
      confirmBody: "Bu tür ve bağlı teklifler otomatik silme ilişkisi nedeniyle silinir.",
      confirmDelete: "Sil",
      loading: "Yükleniyor...",
      count: "Sayı",
    },
    offers: {
      management: "Teklif Yönetimi",
      subtitle: "Tekil veya sürgülü teklifler oluşturun, şehirleri ve detayları atayın.",
      createOffer: "Teklif Oluştur",
      editOffer: "Teklifi Düzenle",
      save: "Kaydet",
      cancel: "İptal",
      delete: "Sil",
      addOfferDetails: "Teklif Detayı Ekle",
      title: "Başlık",
      type: "Tür",
      cities: "Şehirler",
      body: "Detay",
      urlType: "Bağlantı Türü",
      url: "Bağlantı",
      station: "İstasyon",
      sortOrder: "Sıralama",
      actions: "İşlemler",
      details: "Teklif Detayları",
      offerList: "Teklif Listesi",
      search: "Tekliflerde ara...",
      noOffers: "Henüz teklif yok.",
      selectOffer: "Düzenlemek için listeden bir teklif seçin.",
      newOffer: "Yeni Teklif",
      detailTitle: "Detay başlığı",
      file: "Dosya",
      chooseFile: "Dosya seç",
      selectedFile: "Seçilen dosya",
      noFile: "Dosya yok",
      mediaReview: "Yüklenen dosya incelemesi",
      mediaImage: "Görsel",
      mediaVideo: "Video",
      mediaPending: "Bekliyor — kaydettiğinizde yüklenir",
      mediaStored: "Kayıtlı dosya",
      removeFile: "Dosyayı kaldır",
      invalidMediaType: "Yalnızca görsel veya video dosyaları yüklenebilir.",
      mediaTooLarge: "Dosya 100 MB sınırını aşıyor.",
      mediaHint: "Yalnızca görsel veya video, en fazla 100 MB.",
      mediaStorageTitle: "Dosya yükleme kullanılamıyor",
      mediaStorageBody:
        "Kampanya medya kolonları veritabanında bulunmadığı için görsel ve videolar henüz saklanamıyor. Bekleyen supabase/migrations/20260730090000_add_offer_detail_media.sql taşımasını uygulayıp yeniden deneyin. Diğer tüm kampanya alanları normal şekilde kaydedilir.",
      moveUp: "Yukarı taşı",
      moveDown: "Aşağı taşı",
      removeDetail: "Detayı kaldır",
      singleHint: "Tekil tür: yalnızca bir detay bölümü tutulur.",
      sliderHint: "Sürgülü tür: birden fazla detay ekleyip sıralayabilirsiniz.",
      titlePlaceholder: "Örnek: Hafta sonu teklifi",
      detailTitlePlaceholder: "Örnek: Özel indirim",
      bodyPlaceholder: "Teklif detaylarını yazın...",
      urlPlaceholder: "https://example.com",
      stationPlaceholder: "İstasyon seç",
      citiesPlaceholder: "Şehirleri seç",
      typePlaceholder: "Tür seç",
      loading: "Yükleniyor...",
      requiredTitle: "Teklif başlığı gerekli",
      requiredType: "Teklif türü gerekli",
      requiredCities: "En az bir şehir seçin",
      requiredDetails: "En az bir detay ekleyin",
      saved: "Teklif kaydedildi",
      deleted: "Teklif silindi",
      loadError: "Teklifler yüklenemedi",
      saveError: "Teklif kaydedilemedi",
      deleteError: "Teklif silinemedi",
      confirmDeleteTitle: "Teklif silinsin mi?",
      confirmDeleteBody: "Teklif ve tüm detayları silinir.",
      confirmDelete: "Sil",
      all: "Tümü",
      single: "Tekil",
      slider: "Sürgülü Slider",
      inside: "İç",
      outside: "Dış",
      none: "Yok",
    },
    sidebar: {
      offers: "Teklifler",
      offerTypes: "Teklif türleri",
    },
    cities: {
      All: "Tümü",
      Baghdad: "Bağdat",
      Erbil: "Erbil",
      Basra: "Basra",
      Mosul: "Musul",
      Sulaymaniyah: "Süleymaniye",
      Kirkuk: "Kerkük",
      Karbala: "Kerbela",
      Najaf: "Necef",
      Duhok: "Duhok",
      Ramadi: "Ramadi",
      Tikrit: "Tikrit",
      Nasiriyah: "Nasıriye",
      Amarah: "Amara",
      Diwaniyah: "Divaniye",
      Kut: "Kut",
      Samawah: "Semave",
      Hilla: "Hille",
      Fallujah: "Felluce",
      Baqubah: "Bakuba",
    },
  },
};

export function localizeOfferTypeName(name: string, language: AppLanguage) {
  const normalized = name.trim().toLowerCase();
  const labels = adminOffersTexts[language].offers;

  if (normalized === "single" || normalized.includes("single")) return labels.single;
  if (normalized === "slider" || normalized.includes("slider")) return labels.slider;

  return name;
}

export function localizeUrlType(value: string, language: AppLanguage) {
  const labels = adminOffersTexts[language].offers;

  if (value === "Inside") return labels.inside;
  if (value === "Outside") return labels.outside;
  return labels.none;
}
