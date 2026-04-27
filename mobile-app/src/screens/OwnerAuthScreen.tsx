import React, { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, palette } from '../theme';
import { SectionTitle } from '../components/SectionTitle';
import { signInOwner, signUpOwner } from '../lib/ownerApi';

export function OwnerAuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (payload: { userId: string; email: string; sessionToken: string }) => void;
}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [signinIdentifier, setSigninIdentifier] = useState('');
  const [signinPassword, setSigninPassword] = useState('');

  const [signup, setSignup] = useState({
    ownerName: '',
    ownerPhone: '',
    email: '',
    password: '',
    confirmPassword: '',
    stationName: '',
    shortAddress: '',
    detailedAddress: '',
    openTime: '08:00',
    closeTime: '22:00',
    firstServiceName: '',
    firstServicePrice: '',
    firstServiceDuration: '30',
  });

  const handleSignIn = async () => {
    setLoading(true);
    setMessage(null);
    const result = await signInOwner(signinIdentifier, signinPassword);
    setLoading(false);
    if (result.success && result.userId && result.email && result.sessionToken) {
      onAuthenticated({
        userId: result.userId,
        email: result.email,
        sessionToken: result.sessionToken,
      });
    }
    setMessage(result.success ? `تم تسجيل الدخول بنجاح. البريد المستخدم فعلياً: ${result.email}` : result.error || 'تعذر تسجيل الدخول.');
  };

  const handleSignUp = async () => {
    if (signup.password !== signup.confirmPassword) {
      setMessage('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setLoading(true);
    setMessage(null);
    const result = await signUpOwner(signup);
    setLoading(false);
    if (result.success && result.userId && result.email && result.sessionToken) {
      onAuthenticated({
        userId: result.userId,
        email: result.email,
        sessionToken: result.sessionToken,
      });
    }
    setMessage(result.success ? `تم إنشاء الحساب والدخول مباشرة. البريد الفعلي للحساب: ${result.email}` : result.error || 'تعذر إنشاء الحساب.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={gradients.owner} style={styles.hero}>
        <Text style={styles.heroBadge}>بوابة المحطات</Text>
        <Text style={styles.heroTitle}>حساب واحد لصاحب الغسل أو المحطة</Text>
        <Text style={styles.heroText}>هذه الشاشة مربوطة فعلياً بخوادم التسجيل والدخول الحالية في مشروعك، ويمكن التجربة بالإيميل أو رقم الواتساب أو الاسم مع كلمة المرور.</Text>
      </LinearGradient>

      <View style={styles.tabs}>
        <Pressable style={[styles.tab, mode === 'signup' && styles.activeTab]} onPress={() => setMode('signup')}>
          <Text style={[styles.tabText, mode === 'signup' && styles.activeTabText]}>إنشاء حساب محطة</Text>
        </Pressable>
        <Pressable style={[styles.tab, mode === 'signin' && styles.activeTab]} onPress={() => setMode('signin')}>
          <Text style={[styles.tabText, mode === 'signin' && styles.activeTabText]}>لدي حساب - تسجيل الدخول</Text>
        </Pressable>
      </View>

      {message ? (
        <View style={[styles.messageBox, message.includes('تم') ? styles.successBox : styles.errorBox]}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      ) : null}

      {mode === 'signup' ? (
        <>
          <SectionTitle title="بيانات الحساب" subtitle="نسخة موبايل مربوطة بمنطق owner-self-register الحقيقي في مشروعك." />
          <View style={styles.card}>
            <Field label="اسم المالك" value={signup.ownerName} onChangeText={(value) => setSignup((prev) => ({ ...prev, ownerName: value }))} placeholder="أحمد محمد" />
            <Field label="رقم الواتساب" value={signup.ownerPhone} onChangeText={(value) => setSignup((prev) => ({ ...prev, ownerPhone: value }))} placeholder="0770xxxxxxx" />
            <Field label="البريد الإلكتروني (اختياري)" value={signup.email} onChangeText={(value) => setSignup((prev) => ({ ...prev, email: value }))} placeholder="info@washlly.com" />
            <View style={styles.rowFields}>
              <View style={styles.rowField}><Field label="كلمة المرور" value={signup.password} onChangeText={(value) => setSignup((prev) => ({ ...prev, password: value }))} placeholder="أحرف على الأقل 6" secure /></View>
              <View style={styles.rowField}><Field label="تأكيد كلمة المرور" value={signup.confirmPassword} onChangeText={(value) => setSignup((prev) => ({ ...prev, confirmPassword: value }))} placeholder="أعد كتابة كلمة المرور" secure /></View>
            </View>
          </View>

          <SectionTitle title="بيانات المحطة" subtitle="أدخل الاسم، المنطقة، وساعات العمل حتى تكون المحطة جاهزة للظهور." />
          <View style={styles.card}>
            <Field label="اسم المحطة" value={signup.stationName} onChangeText={(value) => setSignup((prev) => ({ ...prev, stationName: value }))} placeholder="Washlly Express" />
            <Field label="العنوان المختصر" value={signup.shortAddress} onChangeText={(value) => setSignup((prev) => ({ ...prev, shortAddress: value }))} placeholder="المنصور - شارع الأميرات" />
            <Field label="العنوان التفصيلي" value={signup.detailedAddress} onChangeText={(value) => setSignup((prev) => ({ ...prev, detailedAddress: value }))} placeholder="أقرب معلم، نقطة الوصول، تفاصيل إضافية" multiline />
            <View style={styles.rowFields}>
              <View style={styles.rowField}><Field label="وقت الفتح" value={signup.openTime} onChangeText={(value) => setSignup((prev) => ({ ...prev, openTime: value }))} placeholder="08:00" /></View>
              <View style={styles.rowField}><Field label="وقت الإغلاق" value={signup.closeTime} onChangeText={(value) => setSignup((prev) => ({ ...prev, closeTime: value }))} placeholder="22:00" /></View>
            </View>
          </View>

          <SectionTitle title="الخدمات" subtitle="إضافة خدمة أولى ثم التوسع لاحقاً داخل بوابة المحطة." />
          <View style={styles.card}>
            <Field label="الخدمة #1" value={signup.firstServiceName} onChangeText={(value) => setSignup((prev) => ({ ...prev, firstServiceName: value }))} placeholder="غسيل سطحي" />
            <View style={styles.rowFields}>
              <View style={styles.rowField}><Field label="السعر" value={signup.firstServicePrice} onChangeText={(value) => setSignup((prev) => ({ ...prev, firstServicePrice: value }))} placeholder="10000" /></View>
              <View style={styles.rowField}><Field label="المدة" value={signup.firstServiceDuration} onChangeText={(value) => setSignup((prev) => ({ ...prev, firstServiceDuration: value }))} placeholder="30" /></View>
            </View>
          </View>

          <Pressable style={styles.primaryAction} onPress={handleSignUp} disabled={loading}>
            {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryActionText}>إنشاء الحساب والدخول مباشرة</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <SectionTitle title="تسجيل الدخول" subtitle="يمكن لصاحب المحطة الدخول باستخدام الإيميل أو رقم الواتساب أو الاسم." />
          <View style={styles.card}>
            <Field label="الإيميل أو رقم الواتساب أو الاسم" value={signinIdentifier} onChangeText={setSigninIdentifier} placeholder="0770xxxxxxx أو info@washlly.com" />
            <Field label="كلمة المرور" value={signinPassword} onChangeText={setSigninPassword} placeholder="أدخل كلمة المرور" secure />
            <Pressable style={styles.primaryAction} onPress={handleSignIn} disabled={loading}>
              {loading ? <ActivityIndicator color={palette.white} /> : <Text style={styles.primaryActionText}>تسجيل الدخول</Text>}
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Field({ label, placeholder, multiline, secure, value, onChangeText }: { label: string; placeholder: string; multiline?: boolean; secure?: boolean; value: string; onChangeText: (value: string) => void; }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#8aa0b8" multiline={multiline} secureTextEntry={secure} style={[styles.input, multiline && styles.textArea]} textAlign="right" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.sand },
  content: { padding: 20, gap: 20, paddingBottom: 42 },
  hero: { borderRadius: 28, padding: 22, gap: 10 },
  heroBadge: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.16)', color: palette.white, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, overflow: 'hidden', fontWeight: '700' },
  heroTitle: { color: palette.white, fontWeight: '900', fontSize: 28, lineHeight: 36, textAlign: 'right' },
  heroText: { color: 'rgba(255,255,255,0.82)', lineHeight: 24, textAlign: 'right' },
  tabs: { flexDirection: 'row-reverse', backgroundColor: '#eaf2f8', borderRadius: 18, padding: 6, gap: 6 },
  tab: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  activeTab: { backgroundColor: palette.white },
  tabText: { color: palette.muted, fontWeight: '700', fontSize: 13 },
  activeTabText: { color: palette.deepBlue },
  messageBox: { borderRadius: 18, padding: 14 },
  successBox: { backgroundColor: '#e8f6ee', borderWidth: 1, borderColor: '#c7ead5' },
  errorBox: { backgroundColor: '#fff0f0', borderWidth: 1, borderColor: '#f3c4c4' },
  messageText: { textAlign: 'right', color: palette.text, lineHeight: 22, fontWeight: '700' },
  card: { backgroundColor: palette.white, borderRadius: 24, padding: 16, gap: 14, borderWidth: 1, borderColor: palette.line },
  fieldWrap: { gap: 8 },
  label: { textAlign: 'right', color: palette.text, fontWeight: '700', fontSize: 14 },
  input: { backgroundColor: '#f8fbfe', borderWidth: 1, borderColor: palette.line, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, color: palette.text },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  rowFields: { flexDirection: 'row-reverse', gap: 10 },
  rowField: { flex: 1 },
  primaryAction: { backgroundColor: palette.deepBlue, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  primaryActionText: { color: palette.white, fontSize: 15, fontWeight: '800' },
});
