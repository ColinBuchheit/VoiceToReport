// voice-report-app/screens/OnboardingScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image, Animated, Easing } from 'react-native';
import userProfileService, { UserProfile } from '../services/userProfileService';
import { useTheme } from '../context/ThemeContext';
const LIGHT_LOGO = require('../assets/bears&t.png');
const DARK_LOGO = require('../assets/DarkModeLogo.png');
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';

type OnboardingNav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

interface Props { navigation: OnboardingNav; }

export default function OnboardingScreen({ navigation }: Props) {
  const { colors, isDark } = useTheme();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; workEmail?: string }>({});
  const lastNameRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);

  // Simple transition anims
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    (async () => {
      const existing = await userProfileService.getProfile();
      if (existing) {
        setFirstName(existing.firstName);
        setLastName(existing.lastName);
        setWorkEmail(existing.workEmail);
      }
      setLoading(false);
    })();
  }, []);

  const validators = {
    firstName: (v: string) => v.trim() ? '' : 'First name required',
    lastName: (v: string) => v.trim() ? '' : 'Last name required',
    workEmail: (v: string) => {
      if (!v.trim()) return 'Work email required';
      const emailRegex = /.+@.+\..+/;
      return emailRegex.test(v.trim()) ? '' : 'Enter a valid email';
    },
  } as const;

  const validateAll = (): boolean => {
    const fe: typeof fieldErrors = {};
    const fnErr = validators.firstName(firstName);
    if (fnErr) fe.firstName = fnErr;
    const lnErr = validators.lastName(lastName);
    if (lnErr) fe.lastName = lnErr;
    const emErr = validators.workEmail(workEmail.toLowerCase());
    if (emErr) fe.workEmail = emErr;
    setFieldErrors(fe);
    return Object.keys(fe).length === 0;
  };

  const isFormValid = () => {
    return firstName.trim() && lastName.trim() && validators.workEmail(workEmail) === '';
  };

  const handleSave = async () => {
    if (!validateAll()) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const profile: UserProfile = { workEmail: workEmail.trim(), firstName: firstName.trim(), lastName: lastName.trim() };
      await userProfileService.saveProfile(profile);
      // Success transition: subtle morph then navigate
      setShowSuccess(true);
      Animated.sequence([
        Animated.spring(buttonScale, { toValue: 1.05, useNativeDriver: true, friction: 5, tension: 120 }),
        Animated.parallel([
          Animated.timing(contentOpacity, { toValue: 0.15, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(overlayOpacity, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(logoScale, { toValue: 1.1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(logoScale, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ]),
      ]).start(({ finished }) => {
        if (finished) {
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
        }
      });
    } catch (e) {
      setFormError('Failed to save profile, please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={colors.accent} /><Text style={[styles.loadingText, { color: colors.textPrimary }]}>Loading...</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: colors.background }]} keyboardShouldPersistTaps="handled">
        {/* Hero / Brand */}
        <Animated.View style={[styles.header, { opacity: contentOpacity }]}> 
          <Animated.View style={[styles.logoWrapper, { transform: [{ scale: logoScale }] }]}> 
            <Image
              key={isDark ? 'dark-logo' : 'light-logo'}
              source={isDark ? DARK_LOGO : LIGHT_LOGO}
              style={styles.logo}
              resizeMode="contain"
            />
          </Animated.View>
          <Text style={[styles.appName, { color: colors.accent }]}>Voice Report</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>Turn field notes into professional reports</Text>
        </Animated.View>

        {/* Benefits Card */}
        <Animated.View style={[styles.introCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, opacity: contentOpacity }]}>
          <View style={styles.introTitleRow}>
            <Text style={[styles.introTitle, { color: colors.textPrimary }]}>Welcome</Text>
          </View>
          <Text style={[styles.introText, { color: colors.textPrimary }]}>Tell us your name and work email to personalize your reports.</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={[styles.benefitItem, { color: colors.textPrimary }]}>Your name auto-fills each summary</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={[styles.benefitItem, { color: colors.textPrimary }]}>Your email is copied on every report</Text>
            </View>
            <View style={styles.benefitRow}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" style={{ marginRight: 8 }} />
              <Text style={[styles.benefitItem, { color: colors.textPrimary }]}>Consistent, professional signature</Text>
            </View>
          </View>
          <Text style={[styles.privacyNote, { color: colors.textSecondary }]}>Stored on this device only. You can clear it anytime in Settings.</Text>
        </Animated.View>

        {/* FIRST NAME */}
        <Animated.View style={[styles.formGroup, { opacity: contentOpacity }]}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>First Name</Text>
            {fieldErrors.firstName ? <Text style={styles.inlineError}>{fieldErrors.firstName}</Text> : null}
          </View>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }, fieldErrors.firstName && styles.inputRowError]}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
            value={firstName}
            onChangeText={(v)=>{ setFirstName(v); if(fieldErrors.firstName) setFieldErrors(p=>({ ...p, firstName: undefined })); }}
            onBlur={()=>{ const err = validators.firstName(firstName); if(err) setFieldErrors(p=>({...p, firstName: err})); }}
            style={[styles.input, { color: colors.textPrimary }, fieldErrors.firstName && styles.inputError]}
            placeholder="Jane"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={()=> lastNameRef.current?.focus()}
            placeholderTextColor={colors.textSecondary}
          />
          </View>
        </Animated.View>
        {/* LAST NAME */}
        <Animated.View style={[styles.formGroup, { opacity: contentOpacity }]}>
          <View style={styles.labelRow}><Text style={[styles.label, { color: colors.textPrimary }]}>Last Name</Text>{fieldErrors.lastName ? <Text style={styles.inlineError}>{fieldErrors.lastName}</Text> : null}</View>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }, fieldErrors.lastName && styles.inputRowError]}>
          <Ionicons name="id-card-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            ref={lastNameRef}
            value={lastName}
            onChangeText={(v)=>{ setLastName(v); if(fieldErrors.lastName) setFieldErrors(p=>({ ...p, lastName: undefined })); }}
            onBlur={()=>{ const err = validators.lastName(lastName); if(err) setFieldErrors(p=>({...p, lastName: err})); }}
            style={[styles.input, { color: colors.textPrimary }, fieldErrors.lastName && styles.inputError]}
            placeholder="Doe"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={()=> emailRef.current?.focus()}
            placeholderTextColor={colors.textSecondary}
          />
          </View>
        </Animated.View>
        {/* EMAIL */}
        <Animated.View style={[styles.formGroup, { opacity: contentOpacity }]}>
          <View style={styles.labelRow}><Text style={[styles.label, { color: colors.textPrimary }]}>Work Email</Text>{fieldErrors.workEmail ? <Text style={styles.inlineError}>{fieldErrors.workEmail}</Text> : null}</View>
          <View style={[styles.inputRow, { borderColor: colors.border, backgroundColor: colors.surface }, fieldErrors.workEmail && styles.inputRowError]}>
          <Ionicons name="mail-outline" size={18} color={colors.textSecondary} style={styles.inputIcon} />
          <TextInput
            ref={emailRef}
            value={workEmail}
            onChangeText={(v)=>{ const nv=v.trimStart(); setWorkEmail(nv); if(fieldErrors.workEmail) setFieldErrors(p=>({ ...p, workEmail: undefined })); }}
            onBlur={()=>{ const err = validators.workEmail(workEmail.toLowerCase()); if(err) setFieldErrors(p=>({...p, workEmail: err})); else setWorkEmail(workEmail.toLowerCase()); }}
            style={[styles.input, { color: colors.textPrimary }, fieldErrors.workEmail && styles.inputError]}
            placeholder="name@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            autoCorrect={false}
            placeholderTextColor={colors.textSecondary}
          />
          </View>
        </Animated.View>

  {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <AnimatedTouchable
          style={[
            styles.saveButton,
            { backgroundColor: colors.accent, transform: [{ scale: buttonScale }] },
            (saving || !isFormValid()) && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={saving || !isFormValid()}
          accessibilityLabel="Save profile and continue"
        >
          {saving ? (
            <ActivityIndicator color={colors.accentContrast} />
          ) : showSuccess ? (
            <View style={styles.successRow}>
              <Ionicons name="checkmark-circle" size={18} color={colors.accentContrast} style={{ marginRight: 6 }} />
              <Text style={[styles.saveButtonText, { color: colors.accentContrast }]}>Saved</Text>
            </View>
          ) : (
            <Text style={[styles.saveButtonText, { color: colors.accentContrast }]}>Save & Continue</Text>
          )}
        </AnimatedTouchable>

        <View style={styles.footerNoteWrapper}>
          <Text style={[styles.footerNote, { color: colors.textSecondary }]}>You can update or clear this information later in Settings.</Text>
        </View>
      </ScrollView>

      {/* Transition Overlay */}
      <Animated.View pointerEvents="none" style={[styles.overlay, { backgroundColor: colors.background, opacity: overlayOpacity }]}> 
        <Animated.View style={{ alignItems:'center', transform: [{ scale: logoScale }] }}>
          <Image
            key={isDark ? 'dark-logo-overlay' : 'light-logo-overlay'}
            source={isDark ? DARK_LOGO : LIGHT_LOGO}
            style={styles.overlayLogo}
            resizeMode="contain"
          />
        </Animated.View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 28, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#fff' },
  loadingText: { marginTop:12, color:'#374151' },
  header: { marginTop: 30, marginBottom: 10, alignItems:'center' },
  logo: { width: 200, height: 75, marginBottom: 8 },
  logoWrapper: { paddingHorizontal:16, paddingVertical:8, borderRadius:20, marginBottom:8, backgroundColor:'transparent' },
  // Removed dark-mode size/padding differences; unified sizing
  appName: { fontSize: 28, fontWeight: '700', color: '#FF6B35' },
  tagline: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  introCard: { backgroundColor:'#FFF5F0', borderWidth:1, borderColor:'#FFE0D2', padding:18, borderRadius:14, marginVertical:22 },
  introTitleRow: { flexDirection:'row', alignItems:'center', justifyContent:'flex-start', marginBottom:10 },
  introTitle: { fontSize:22, fontWeight:'700', color:'#1F2937', marginBottom:10, letterSpacing:0.3 },
  introText: { fontSize:14, color:'#374151', lineHeight:20, marginBottom:8 },
  benefitsList: { marginBottom:10, gap:4 },
  benefitRow: { flexDirection:'row', alignItems:'center' },
  benefitItem: { fontSize:13.5, color:'#374151', lineHeight:18, flexShrink:1 },
  privacyNote: { fontSize:12, color:'#6B7280', lineHeight:17, marginTop:4 },
  formGroup: { marginBottom:18 },
  inputRow: { flexDirection:'row', alignItems:'center', borderWidth:1, borderColor:'#D1D5DB', borderRadius:10, backgroundColor:'#FFFFFF' },
  inputRowError: { borderColor:'#DC2626', backgroundColor:'#FFF7F7' },
  inputIcon: { marginLeft:12, marginRight:8 },
  label: { fontSize:13, fontWeight:'600', color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 },
  labelRow: { flexDirection:'row', alignItems:'baseline', justifyContent:'space-between', marginBottom:6 },
  input: { flex:1, paddingHorizontal:4, paddingRight:12, paddingVertical:12, fontSize:16 },
  inputError: { borderColor:'#DC2626', backgroundColor:'#FFF7F7' },
  inlineError: { color:'#DC2626', fontSize:11, fontWeight:'500' },
  formError: { color:'#DC2626', marginBottom:14, fontSize:13, fontWeight:'500' },
  error: { color:'#DC2626', marginBottom:12, fontSize:13 },
  saveButton: { backgroundColor:'#FF6B35', paddingVertical:16, borderRadius:14, alignItems:'center', marginTop:8, shadowColor:'#FF6B35', shadowOpacity:0.35, shadowOffset:{ width:0, height:6 }, shadowRadius:12, elevation:5 },
  saveButtonDisabled: { opacity:0.6 },
  saveButtonText: { color:'#FFFFFF', fontSize:16, fontWeight:'600' },
  successRow: { flexDirection:'row', alignItems:'center' },
  footerNoteWrapper: { marginTop:26 },
  footerNote: { fontSize:12, color:'#6B7280', textAlign:'center', lineHeight:17 },
  stepPill: { paddingHorizontal:10, paddingVertical:4, borderRadius:999, backgroundColor:'#FFECE4', borderWidth:1, borderColor:'#FFD4C1' },
  stepPillText: { fontSize:11, fontWeight:'700', color:'#FF6B35' },
  overlay: { position:'absolute', left:0, right:0, top:0, bottom:0, justifyContent:'center', alignItems:'center' },
  overlayLogo: { width: 220, height: 72 },
});
