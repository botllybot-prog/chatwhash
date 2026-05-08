import React, { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";
import { BottomTabs } from "./src/components/BottomTabs";
import { CustomerHomeScreen } from "./src/screens/CustomerHomeScreen";
import { OwnerAuthScreen } from "./src/screens/OwnerAuthScreen";
import { OwnerPortalScreen } from "./src/screens/OwnerPortalScreen";
import { supabase } from "./src/lib/supabase";
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
  const [restoringSession, setRestoringSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const session = data.session;
      if (session?.user) {
        setOwnerSession({
          userId: session.user.id,
          email: session.user.email || "",
          sessionToken: session.access_token,
        });
      }
      setRestoringSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        setOwnerSession({
          userId: session.user.id,
          email: session.user.email || "",
          sessionToken: session.access_token,
        });
      } else {
        setOwnerSession(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

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
          onLogout={() => supabase.auth.signOut()}
        />
      );
    }

    if (activeTab === "map") {
      return (
        <CustomerHomeScreen
          mode="map"
          onOpenOwner={() => setActiveTab("owner")}
          onOpenMap={() => setActiveTab("map")}
        />
      );
    }
    if (activeTab === "stations") {
      return (
        <CustomerHomeScreen
          mode="stations"
          onOpenOwner={() => setActiveTab("owner")}
          onOpenMap={() => setActiveTab("map")}
        />
      );
    }
    return (
      <CustomerHomeScreen
        mode="home"
        onOpenOwner={() => setActiveTab("owner")}
        onOpenMap={() => setActiveTab("map")}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor={palette.sand} />
      <View style={styles.header}>
        <Text style={styles.brand}>Washlly Mobile</Text>
      </View>
      <View style={styles.body}>
        {restoringSession ? <ActivityIndicator color={palette.deepBlue} style={styles.loader} /> : renderScreen()}
      </View>
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
  body: { flex: 1 },
  loader: { marginTop: 40 },
});
