import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SectionTitle } from "../components/SectionTitle";
import { gradients, palette } from "../theme";
import type { OwnerContext, PackageDefinition, PaymentRow, SubscriptionSummary } from "../types";
import {
  activatePackageForTesting,
  getPackageByCode,
  getPaymentIntegrationInfo,
  loadLatestSubscription,
  loadOwnerContext,
  loadPayments,
  OWNER_PACKAGES,
} from "../lib/subscriptionApi";

export function OwnerPortalScreen({
  ownerUserId,
  onLogout,
}: {
  ownerUserId: string;
  onLogout: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [ownerContext, setOwnerContext] = useState<OwnerContext | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPackageCode, setSelectedPackageCode] = useState<PackageDefinition["code"]>("starter_20");
  const [lastRedirectUrl, setLastRedirectUrl] = useState<string | null>(null);
  const [lastTransactionId, setLastTransactionId] = useState<string | null>(null);

  const selectedPackage = useMemo(
    () => OWNER_PACKAGES.find((item) => item.code === selectedPackageCode) || OWNER_PACKAGES[0],
    [selectedPackageCode],
  );
  const activePackage = getPackageByCode(subscription?.packageCode || null);
  const integrationInfo = getPaymentIntegrationInfo();

  const freeRemaining = Math.max(
    0,
    Number(ownerContext?.freeRequestsQuota || 0) - Number(ownerContext?.freeRequestsUsed || 0),
  );
  const subscriptionRemaining =
    subscription?.requestLimit === null
      ? null
      : Math.max(0, Number(subscription?.requestLimit || 0) - Number(subscription?.requestsUsed || 0));

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const owner = await loadOwnerContext(ownerUserId);
      setOwnerContext(owner);
      const sub = await loadLatestSubscription(owner.stationId);
      setSubscription(sub);
      if (sub?.id) {
        const pay = await loadPayments(sub.id);
        setPayments(pay);
      } else {
        setPayments([]);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "تعذر تحميل بوابة المحطة.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, [ownerUserId]);

  const activateSelectedPackage = async () => {
    if (!ownerContext) return;
    setActivating(true);
    setNotice(null);
    try {
      const activation = await activatePackageForTesting({
        stationId: ownerContext.stationId,
        packageCode: selectedPackage.code,
      });
      setLastRedirectUrl(activation.redirectUrl);
      setLastTransactionId(activation.transactionId);
      setNotice(
        `تم تفعيل ${selectedPackage.title} بنجاح. رقم العملية: ${activation.transactionId}`,
      );
      await refresh();
    } catch (activationError) {
      setError(
        activationError instanceof Error ? activationError.message : "تعذر تفعيل الباقة.",
      );
    } finally {
      setActivating(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={gradients.owner} style={styles.hero}>
        <Text style={styles.heroBadge}>Station Portal</Text>
        <Text style={styles.heroTitle}>بوابة المحطة الكاملة</Text>
        <Text style={styles.heroText}>
          إدارة الرصيد المجاني والباقات، تفعيل اشتراك جديد، ومراجعة الدفعات من داخل تطبيق الموبايل.
        </Text>
        <View style={styles.heroButtons}>
          <Pressable style={styles.lightBtn} onPress={refresh}>
            <Text style={styles.lightBtnText}>{loading ? "جاري التحميل..." : "تحديث البوابة"}</Text>
          </Pressable>
          <Pressable style={styles.darkBtn} onPress={onLogout}>
            <Text style={styles.darkBtnText}>تسجيل الخروج</Text>
          </Pressable>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={palette.deepBlue} />
          <Text style={styles.loadingText}>جاري تحميل بيانات الحساب والاشتراكات...</Text>
        </View>
      ) : null}

      {error ? <Notice text={error} kind="error" /> : null}
      {notice ? <Notice text={notice} kind="success" /> : null}

      {ownerContext ? (
        <>
          <SectionTitle title="ملخص المحطة" subtitle="الحالة الحالية للظهور والرصيد المجاني." />
          <View style={styles.grid}>
            <StatCard
              title="المحطة"
              value={ownerContext.stationName}
              small={ownerContext.stationIsActive ? "ظاهرة في الخريطة" : "متوقفة حالياً"}
            />
            <StatCard title="المجاني المتبقي" value={`${freeRemaining}`} small="طلبات متبقية" />
            <StatCard
              title="الاشتراك الحالي"
              value={activePackage?.title || "لا يوجد"}
              small={subscription?.status || "غير مفعل"}
            />
            <StatCard
              title="رصيد الاشتراك"
              value={subscriptionRemaining === null ? "غير محدود" : `${subscriptionRemaining}`}
              small="طلبات متبقية"
            />
          </View>

          <SectionTitle
            title="اختر باقتك"
            subtitle="هذه البطاقات قابلة للاختيار ثم التفعيل الفعلي التجريبي عبر callback."
          />
          <View style={styles.packageList}>
            {OWNER_PACKAGES.map((pkg) => {
              const selected = pkg.code === selectedPackageCode;
              return (
                <Pressable
                  key={pkg.code}
                  style={[styles.packageCard, selected && styles.packageCardSelected]}
                  onPress={() => setSelectedPackageCode(pkg.code)}
                >
                  <Text style={[styles.packageTitle, selected && styles.packageTitleSelected]}>
                    {pkg.title}
                  </Text>
                  <Text style={[styles.packagePrice, selected && styles.packagePriceSelected]}>
                    ${pkg.priceUsd}
                  </Text>
                  <Text style={[styles.packageMeta, selected && styles.packageMetaSelected]}>
                    {pkg.requestLimit === null ? "طلبات غير محدودة" : `${pkg.requestLimit} طلب`}
                  </Text>
                  <Text style={[styles.packageMeta, selected && styles.packageMetaSelected]}>
                    {pkg.description}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>الباقة المختارة: {selectedPackage.title}</Text>
            <Text style={styles.cardSub}>
              السعر ${selectedPackage.priceUsd} • مدة التفعيل 30 يوم •
              {" "}
              {selectedPackage.requestLimit === null
                ? "بدون حد للطلبات"
                : `${selectedPackage.requestLimit} طلب`}
            </Text>
            <Pressable
              style={[styles.activateBtn, activating && styles.disabledBtn]}
              onPress={activateSelectedPackage}
              disabled={activating}
            >
              {activating ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={styles.activateBtnText}>دفع وتفعيل الباقة الآن (تجريبي)</Text>
              )}
            </Pressable>
          </View>

          <SectionTitle
            title="معلومات ربط بوابة الدفع"
            subtitle="جاهزة للاستخدام مع أي مزود دفع يطلب callback و redirection."
          />
          <View style={styles.card}>
            <Text style={styles.linkLabel}>API Callback URL</Text>
            <Text style={styles.linkValue}>{integrationInfo.callbackUrl}</Text>
            <Text style={styles.linkLabel}>Redirection URL (Dynamic)</Text>
            <Text style={styles.linkValue}>{integrationInfo.redirectionTemplate}</Text>
            {lastRedirectUrl ? (
              <>
                <Text style={styles.linkLabel}>آخر رابط إعادة توجيه تم توليده</Text>
                <Text style={styles.linkValue}>{lastRedirectUrl}</Text>
              </>
            ) : null}
            {lastTransactionId ? (
              <>
                <Text style={styles.linkLabel}>آخر Transaction ID</Text>
                <Text style={styles.linkValue}>{lastTransactionId}</Text>
              </>
            ) : null}
          </View>

          <SectionTitle title="آخر الدفعات" subtitle="يعرض تاريخ التفعيل والدفعات المسجلة على الاشتراك." />
          <View style={styles.card}>
            {payments.length === 0 ? (
              <Text style={styles.cardSub}>لا توجد دفعات مسجلة بعد.</Text>
            ) : (
              payments.map((payment) => (
                <View key={payment.id} style={styles.paymentRow}>
                  <Text style={styles.paymentMain}>${payment.amount}</Text>
                  <Text style={styles.paymentSub}>
                    {payment.status} • {payment.method || "manual"} • {payment.paymentDate?.slice(0, 10) || "--"}
                  </Text>
                </View>
              ))
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

function StatCard({ title, value, small }: { title: string; value: string; small: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSmall}>{small}</Text>
    </View>
  );
}

function Notice({ text, kind }: { text: string; kind: "success" | "error" }) {
  return (
    <View
      style={[
        styles.notice,
        kind === "success" ? styles.noticeSuccess : styles.noticeError,
      ]}
    >
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.sand },
  content: { padding: 18, paddingBottom: 40 },
  hero: { borderRadius: 24, padding: 20, marginBottom: 16 },
  heroBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.15)",
    color: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
    fontWeight: "700",
  },
  heroTitle: { textAlign: "right", color: palette.white, fontWeight: "900", fontSize: 30, marginTop: 8 },
  heroText: { textAlign: "right", color: "rgba(255,255,255,0.84)", lineHeight: 22, marginTop: 8 },
  heroButtons: { flexDirection: "row-reverse", gap: 8, marginTop: 12 },
  lightBtn: {
    flex: 1,
    backgroundColor: palette.white,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  lightBtnText: { color: palette.deepBlue, fontWeight: "800" },
  darkBtn: {
    flex: 1,
    borderRadius: 12,
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
  },
  darkBtnText: { color: palette.white, fontWeight: "800" },
  loadingCard: {
    backgroundColor: palette.white,
    borderRadius: 16,
    padding: 14,
    borderColor: palette.line,
    borderWidth: 1,
    alignItems: "center",
    marginBottom: 14,
  },
  loadingText: { color: palette.muted, marginTop: 8 },
  notice: { borderRadius: 14, padding: 12, marginBottom: 12 },
  noticeSuccess: { backgroundColor: "#e8f6ee", borderColor: "#c8e9d3", borderWidth: 1 },
  noticeError: { backgroundColor: "#fff2f2", borderColor: "#f3c4c4", borderWidth: 1 },
  noticeText: { textAlign: "right", lineHeight: 20, color: palette.text, fontWeight: "700" },
  grid: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  statCard: {
    width: "48.5%",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    backgroundColor: palette.white,
    borderColor: palette.line,
    borderWidth: 1,
  },
  statTitle: { textAlign: "right", color: palette.muted, fontSize: 12 },
  statValue: { textAlign: "right", color: palette.deepBlue, fontSize: 23, fontWeight: "900", marginTop: 4 },
  statSmall: { textAlign: "right", color: palette.text, marginTop: 2, fontSize: 12 },
  packageList: { marginBottom: 12 },
  packageCard: {
    borderRadius: 16,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    padding: 14,
    marginBottom: 8,
  },
  packageCardSelected: { borderColor: palette.brightBlue, backgroundColor: "#eaf3fb" },
  packageTitle: { textAlign: "right", color: palette.text, fontWeight: "800", fontSize: 17 },
  packageTitleSelected: { color: palette.deepBlue },
  packagePrice: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 28, marginTop: 4 },
  packagePriceSelected: { color: palette.deepBlue },
  packageMeta: { textAlign: "right", color: palette.muted, marginTop: 3 },
  packageMetaSelected: { color: palette.deepBlue },
  card: {
    borderRadius: 16,
    borderColor: palette.line,
    borderWidth: 1,
    backgroundColor: palette.white,
    padding: 12,
    marginBottom: 14,
  },
  cardTitle: { textAlign: "right", color: palette.text, fontWeight: "800" },
  cardSub: { textAlign: "right", color: palette.muted, lineHeight: 22, marginTop: 6 },
  activateBtn: {
    marginTop: 10,
    backgroundColor: palette.deepBlue,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  activateBtnText: { color: palette.white, fontWeight: "800" },
  disabledBtn: { opacity: 0.5 },
  linkLabel: { textAlign: "right", color: palette.muted, marginTop: 6, fontSize: 12 },
  linkValue: { textAlign: "right", color: palette.text, fontWeight: "700", marginTop: 3 },
  paymentRow: {
    borderColor: palette.line,
    borderBottomWidth: 1,
    paddingBottom: 8,
    marginBottom: 8,
  },
  paymentMain: { textAlign: "right", color: palette.deepBlue, fontWeight: "900", fontSize: 18 },
  paymentSub: { textAlign: "right", color: palette.muted, marginTop: 3 },
});
