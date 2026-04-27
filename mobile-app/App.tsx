import React, { useMemo, useState } from "react";
import { SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { BottomTabs } from "./src/components/BottomTabs";
import { CustomerHomeScreen } from "./src/screens/CustomerHomeScreen";
import { OwnerAuthScreen } from "./src/screens/OwnerAuthScreen";
import { OwnerPortalScreen } from "./src/screens/OwnerPortalScreen";
import { palette } from "./src/theme";

type TabKey = "home" | "map" | "stations" | "owner";

type OwnerSession = {
  userId: string;
  email: string;
  sessionToken: string;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [ownerSession, setOwnerSession] = useState<OwnerSession | null>(null);

  const subtitle = useMemo(() => {
    if (activeTab === "owner") {
      return ownerSession
        ? "بوابة المحطة: اشتراكات، دفعات، وتفعيل باقات مباشرة."
        : "تسجيل/دخول صاحب المحطة وربط مباشر بـ Supabase.";
    }
    if (activeTab === "map") return "الخريطة + الحجز الكامل + عجلة الخصم + تأكيد/إلغاء.";
    if (activeTab === "stations") return "المحطات والخدمات المتاحة مع تجربة حجز حقيقية.";
    return "واجهة العميل الكاملة لبدء الحجز من التطبيق.";
  }, [activeTab, ownerSession]);

  const renderScreen = () => {
    if (activeTab === "owner") {
      if (!ownerSession) {
        return (
          <OwnerAuthScreen
            onAuthenticated={(payload) => {
              setOwnerSession(payload);
            }}
          />
        );
      }

      return (
        <OwnerPortalScreen
          ownerUserId={ownerSession.userId}
          onLogout={() => {
            setOwnerSession(null);
          }}
        />
      );
    }

    if (activeTab === "map") {
      return <CustomerHomeScreen mode="map" onOpenOwner={() => setActiveTab("owner")} />;
    }
    if (activeTab === "stations") {
      return <CustomerHomeScreen mode="stations" onOpenOwner={() => setActiveTab("owner")} />;
    }
    return <CustomerHomeScreen mode="home" onOpenOwner={() => setActiveTab("owner")} />;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.sand} />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>Washlly Mobile</Text>
          <Text style={styles.sub}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.body}>{renderScreen()}</View>
      <BottomTabs active={activeTab} onChange={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.sand },
  header: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: palette.line,
    backgroundColor: "#f8fbfe",
  },
  brand: { textAlign: "right", fontSize: 24, color: palette.deepBlue, fontWeight: "900" },
  sub: { textAlign: "right", color: palette.muted, marginTop: 4, lineHeight: 20 },
  body: { flex: 1 },
});
