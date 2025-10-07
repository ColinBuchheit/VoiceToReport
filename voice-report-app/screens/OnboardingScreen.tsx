// voice-report-app/screens/OnboardingScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Image } from 'react-native';
import userProfileService, { UserProfile } from '../services/userProfileService';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';

type OnboardingNav = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

interface Props { navigation: OnboardingNav; }

export default function OnboardingScreen({ navigation }: Props) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string; workEmail?: string }>({});
  const lastNameRef = useRef<TextInput | null>(null);
  const emailRef = useRef<TextInput | null>(null);

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
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } catch (e) {
      setFormError('Failed to save profile, please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#FF6B35" /><Text style={styles.loadingText}>Loading...</Text></View>;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}> 
          <Image source={require('../assets/bears&t.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>Voice Report</Text>
          <Text style={styles.tagline}>Turn field notes into professional reports</Text>
        </View>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Welcome</Text>
          <Text style={styles.introText}>We store these details locally so:
          </Text>
          <View style={styles.benefitsList}>
            <Text style={styles.benefitItem}>• Your name auto-fills the summary</Text>
            <Text style={styles.benefitItem}>• Your email address is CC'd on every report</Text>
            <Text style={styles.benefitItem}>• You keep a consistent professional signature</Text>
          </View>
          <Text style={styles.privacyNote}>Data is stored securely on this device only and can be cleared anytime in Settings.</Text>
        </View>

        {/* FIRST NAME */}
        <View style={styles.formGroup}>
          <View style={styles.labelRow}><Text style={styles.label}>First Name</Text>{fieldErrors.firstName ? <Text style={styles.inlineError}>{fieldErrors.firstName}</Text> : null}</View>
          <TextInput
            value={firstName}
            onChangeText={(v)=>{ setFirstName(v); if(fieldErrors.firstName) setFieldErrors(p=>({ ...p, firstName: undefined })); }}
            onBlur={()=>{ const err = validators.firstName(firstName); if(err) setFieldErrors(p=>({...p, firstName: err})); }}
            style={[styles.input, fieldErrors.firstName && styles.inputError]}
            placeholder="Jane"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={()=> lastNameRef.current?.focus()}
          />
        </View>
        {/* LAST NAME */}
        <View style={styles.formGroup}>
          <View style={styles.labelRow}><Text style={styles.label}>Last Name</Text>{fieldErrors.lastName ? <Text style={styles.inlineError}>{fieldErrors.lastName}</Text> : null}</View>
          <TextInput
            ref={lastNameRef}
            value={lastName}
            onChangeText={(v)=>{ setLastName(v); if(fieldErrors.lastName) setFieldErrors(p=>({ ...p, lastName: undefined })); }}
            onBlur={()=>{ const err = validators.lastName(lastName); if(err) setFieldErrors(p=>({...p, lastName: err})); }}
            style={[styles.input, fieldErrors.lastName && styles.inputError]}
            placeholder="Doe"
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={()=> emailRef.current?.focus()}
          />
        </View>
        {/* EMAIL */}
        <View style={styles.formGroup}>
          <View style={styles.labelRow}><Text style={styles.label}>Work Email</Text>{fieldErrors.workEmail ? <Text style={styles.inlineError}>{fieldErrors.workEmail}</Text> : null}</View>
          <TextInput
            ref={emailRef}
            value={workEmail}
            onChangeText={(v)=>{ const nv=v.trimStart(); setWorkEmail(nv); if(fieldErrors.workEmail) setFieldErrors(p=>({ ...p, workEmail: undefined })); }}
            onBlur={()=>{ const err = validators.workEmail(workEmail.toLowerCase()); if(err) setFieldErrors(p=>({...p, workEmail: err})); else setWorkEmail(workEmail.toLowerCase()); }}
            style={[styles.input, fieldErrors.workEmail && styles.inputError]}
            placeholder="name@company.com"
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleSave}
            autoCorrect={false}
          />
        </View>

        {formError ? <Text style={styles.formError}>{formError}</Text> : null}

        <TouchableOpacity
          style={[styles.saveButton, (saving || !isFormValid()) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving || !isFormValid()}
          accessibilityLabel="Save profile and continue"
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save & Continue</Text>}
        </TouchableOpacity>

        <View style={styles.footerNoteWrapper}>
          <Text style={styles.footerNote}>You can update or clear this information later in Settings.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 28, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#fff' },
  loadingText: { marginTop:12, color:'#374151' },
  header: { marginTop: 30, marginBottom: 10, alignItems:'center' },
  logo: { width: 140, height: 60, marginBottom: 8 },
  appName: { fontSize: 28, fontWeight: '700', color: '#FF6B35' },
  tagline: { fontSize: 14, color: '#6B7280', marginTop: 4 },
  introCard: { backgroundColor:'#FFF5F0', borderWidth:1, borderColor:'#FFE0D2', padding:18, borderRadius:14, marginVertical:22 },
  introTitle: { fontSize:22, fontWeight:'700', color:'#1F2937', marginBottom:10, letterSpacing:0.3 },
  introText: { fontSize:14, color:'#374151', lineHeight:20, marginBottom:8 },
  benefitsList: { marginBottom:10, gap:4 },
  benefitItem: { fontSize:13.5, color:'#374151', lineHeight:18 },
  privacyNote: { fontSize:12, color:'#6B7280', lineHeight:17, marginTop:4 },
  formGroup: { marginBottom:18 },
  label: { fontSize:13, fontWeight:'600', color:'#374151', marginBottom:6, textTransform:'uppercase', letterSpacing:0.5 },
  labelRow: { flexDirection:'row', alignItems:'baseline', justifyContent:'space-between', marginBottom:6 },
  input: { borderWidth:1, borderColor:'#D1D5DB', borderRadius:10, paddingHorizontal:14, paddingVertical:12, fontSize:16, backgroundColor:'#FFFFFF' },
  inputError: { borderColor:'#DC2626', backgroundColor:'#FFF7F7' },
  inlineError: { color:'#DC2626', fontSize:11, fontWeight:'500' },
  formError: { color:'#DC2626', marginBottom:14, fontSize:13, fontWeight:'500' },
  error: { color:'#DC2626', marginBottom:12, fontSize:13 },
  saveButton: { backgroundColor:'#FF6B35', paddingVertical:16, borderRadius:14, alignItems:'center', marginTop:8, shadowColor:'#FF6B35', shadowOpacity:0.35, shadowOffset:{ width:0, height:6 }, shadowRadius:12, elevation:5 },
  saveButtonDisabled: { opacity:0.6 },
  saveButtonText: { color:'#FFFFFF', fontSize:16, fontWeight:'600' },
  footerNoteWrapper: { marginTop:26 },
  footerNote: { fontSize:12, color:'#6B7280', textAlign:'center', lineHeight:17 },
});
