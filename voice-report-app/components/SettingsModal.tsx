import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import { useFontScale } from '../context/FontScaleContext';
import userProfileService from '../services/userProfileService';
import { useTheme, ThemeMode } from '../context/ThemeContext';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ visible, onClose }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { fontScale, setFontScale, scaled } = useFontScale();
  const { mode, setMode, colors, isDark } = useTheme();
  // Dynamic slider resolution with graceful fallback if dependency missing
  let SliderComp: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    SliderComp = require('@react-native-community/slider').default;
  } catch {}

  useEffect(() => {
    let mounted = true;
    if (visible) {
      setLoaded(false);
      (async () => {
        try {
          const profile = await userProfileService.getProfile();
          if (!mounted) return;
          if (profile) {
            setFirstName(profile.firstName);
            setLastName(profile.lastName);
            setWorkEmail(profile.workEmail);
          } else {
            setFirstName('');
            setLastName('');
            setWorkEmail('');
          }
        } catch (e) {
          console.warn('Failed to load profile', e);
        } finally {
          if (mounted) setLoaded(true);
        }
      })();
    }
    return () => { mounted = false; };
  }, [visible]);

  const validate = () => {
    if (!firstName.trim()) return 'First name required';
    if (!lastName.trim()) return 'Last name required';
    if (!workEmail.trim()) return 'Work email required';
    const emailRegex = /.+@.+\..+/;
    if (!emailRegex.test(workEmail.trim())) return 'Enter valid email';
    return '';
  };

  const handleSave = async () => {
    const v = validate();
    if (v) { setError(v); return; }
    setSaving(true);
    setError('');
    try {
      await userProfileService.saveProfile({ firstName: firstName.trim(), lastName: lastName.trim(), workEmail: workEmail.trim() });
      onClose();
    } catch (e) {
      setError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    Alert.alert(
      'Clear Profile',
      'This will remove your saved technician name and work email. You can re-enter them later. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: async () => {
            try {
              await userProfileService.clearProfile();
              setFirstName('');
              setLastName('');
              setWorkEmail('');
              setError('');
              onClose();
            } catch (e) {
              Alert.alert('Error', 'Failed to clear profile');
            }
          } }
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.settingsOverlay, { backgroundColor: colors.overlay }]}>
        <TouchableOpacity
          style={styles.settingsBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.settingsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingsHeader}>
            <Text style={[styles.settingsTitle, { fontSize: scaled(24), color: colors.textPrimary }]}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.settingsCloseButton}>
              <Text style={[styles.settingsCloseText, { color: colors.textSecondary }]}>✕</Text>
            </TouchableOpacity>
          </View>
          {!loaded ? (
            <View style={styles.settingsLoadingContainer}>
              <ActivityIndicator size="large" color={colors.accent} />
              <Text style={[styles.settingsLoadingText, { color: colors.textSecondary }]}>Loading profile...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.settingsScroll}
              contentContainerStyle={styles.settingsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { fontSize: scaled(13), color: colors.textSecondary }]}>Technician Profile</Text>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={[styles.settingsItemLabel, { fontSize: scaled(16), color: colors.textPrimary }]}>First Name</Text>
                </View>
                <View style={styles.inlineInputWrapper}>
                  <TextInput value={firstName} onChangeText={setFirstName} style={[styles.inlineInput, { fontSize: scaled(16), color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} placeholder="First name" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={[styles.settingsItemLabel, { fontSize: scaled(16), color: colors.textPrimary }]}>Last Name</Text>
                </View>
                <View style={styles.inlineInputWrapper}>
                  <TextInput value={lastName} onChangeText={setLastName} style={[styles.inlineInput, { fontSize: scaled(16), color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} placeholder="Last name" placeholderTextColor={colors.textSecondary} />
                </View>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={[styles.settingsItemLabel, { fontSize: scaled(16), color: colors.textPrimary }]}>Work Email</Text>
                </View>
                <View style={styles.inlineInputWrapper}>
                  <TextInput value={workEmail} onChangeText={setWorkEmail} style={[styles.inlineInput, { fontSize: scaled(16), color: colors.textPrimary, backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.textSecondary} />
                </View>
                {error ? <Text style={[styles.settingsError, { fontSize: scaled(13) }]}>{error}</Text> : null}
                <TouchableOpacity style={[styles.profileSaveButton, { backgroundColor: colors.accent }, saving && { opacity:0.6 }]} onPress={handleSave} disabled={saving}>
                  <Text style={[styles.profileSaveButtonText, { fontSize: scaled(15), color: colors.accentContrast }]}>{saving ? 'Saving...' : 'Save Profile'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.clearProfileButton, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]} onPress={handleClear}>
                  <Text style={[styles.clearProfileButtonText, { fontSize: scaled(14), color: '#DC2626' }]}>Clear Profile</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { fontSize: scaled(13), color: colors.textSecondary }]}>Appearance</Text>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={[styles.settingsItemLabel, { fontSize: scaled(16), flex:1, color: colors.textPrimary }]}>Theme Mode</Text>
                </View>
                <View style={styles.themeModeRow}>
                  {(['light','dark','system'] as ThemeMode[]).map(opt => {
                    const active = mode === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        onPress={() => setMode(opt)}
                        style={[styles.themeModeButton, {
                          backgroundColor: active ? colors.accent : colors.surfaceAlt,
                          borderColor: active ? colors.accent : colors.border,
                        }]}
                      >
                        <Text style={{
                          color: active ? colors.accentContrast : colors.textPrimary,
                          fontWeight: active ? '700' : '500',
                          fontSize: scaled(14),
                          textTransform: 'capitalize'
                        }}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={{ fontSize: scaled(12), color: colors.textSecondary, marginTop: 6 }}>Use system to follow your device setting automatically.</Text>
              </View>
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { fontSize: scaled(13), color: colors.textSecondary }]}>Accessibility</Text>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={[styles.settingsItemLabel, { fontSize: scaled(16), flex: 1, color: colors.textPrimary }]}>Font Size</Text>
                  <Text style={{ fontSize: scaled(14), color: colors.textSecondary, width: 50, textAlign: 'right' }}>{(fontScale).toFixed(2)}x</Text>
                </View>
                {SliderComp ? (
                  <SliderComp
                    style={{ width: '100%', height: 40 }}
                    minimumValue={0.8}
                    maximumValue={1.6}
                    step={0.05}
                    minimumTrackTintColor={colors.accent}
                    maximumTrackTintColor={colors.border}
                    thumbTintColor={colors.accent}
                    value={fontScale}
                    onValueChange={setFontScale}
                  />
                ) : (
                  <View style={styles.fallbackStepperRow}>
                    <TouchableOpacity accessibilityLabel="Decrease font size" style={styles.stepperButton} onPress={() => setFontScale(fontScale - 0.05)}>
                      <Text style={styles.stepperButtonText}>−</Text>
                    </TouchableOpacity>
                    <View style={styles.stepperValueBox}>
                      <Text style={[styles.stepperValueText, { fontSize: scaled(14), color: colors.textPrimary }]}>{fontScale.toFixed(2)}x</Text>
                    </View>
                    <TouchableOpacity accessibilityLabel="Increase font size" style={styles.stepperButton} onPress={() => setFontScale(fontScale + 0.05)}>
                      <Text style={styles.stepperButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <Text style={{ fontSize: scaled(12), color: colors.textSecondary, marginTop: 4 }}>Adjust overall text size across the app.</Text>
              </View>
              <View style={styles.settingsSection}>
                <Text style={[styles.settingsSectionTitle, { fontSize: scaled(13), color: colors.textSecondary }]}>About</Text>
                <View style={[styles.settingsItem, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.settingsItemLabel, { fontSize: scaled(16), color: colors.textPrimary }]}>Version</Text>
                  <Text style={[styles.settingsItemValue, { fontSize: scaled(16), color: colors.textSecondary }]}>1.0.0</Text>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

export default React.memo(SettingsModal);

const styles = StyleSheet.create({
  settingsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  settingsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  settingsPanel: {
    backgroundColor: '#FFFFFF', // overridden by theme
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    width: '100%',
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  settingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB', // themed inline
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
  },
  settingsCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsCloseText: {
    fontSize: 20,
    color: '#6B7280',
    fontWeight: '600',
  },
  settingsScroll: { flexGrow: 0 },
  settingsScrollContent: { paddingBottom: 40 },
  settingsLoadingContainer: { padding: 32, alignItems: 'center', justifyContent: 'center' },
  settingsLoadingText: { marginTop: 12, color: '#6B7280', fontSize: 14, fontWeight: '500' },
  settingsSection: { paddingHorizontal: 24, paddingVertical: 16 },
  settingsSectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingsItemLabel: { fontSize: 16, color: '#1F2937', fontWeight: '500' },
  settingsItemValue: { fontSize: 16, color: '#6B7280' },
  settingsItemNoBorder: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  inlineInputWrapper: { marginBottom: 12 },
  inlineInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16, backgroundColor: '#FFFFFF' },
  settingsError: { color: '#DC2626', fontSize: 13, marginBottom: 8, marginTop: 4 },
  profileSaveButton: { backgroundColor: '#FF6B35', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  profileSaveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  clearProfileButton: { backgroundColor: '#F3F4F6', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  clearProfileButtonText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },
  // Fallback slider (stepper) styles
  fallbackStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FFE4D7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFC8B0',
    marginHorizontal: 12,
  },
  stepperButtonText: { fontSize: 24, fontWeight: '600', color: '#FF6B35', marginTop: -4 },
  stepperValueBox: {
    minWidth: 70,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  stepperValueText: { fontWeight: '600', color: '#374151' },
  themeModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  themeModeButton: {
    flex: 1,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
