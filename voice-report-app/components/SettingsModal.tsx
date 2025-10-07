import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, TextInput, Alert } from 'react-native';
import userProfileService from '../services/userProfileService';

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
      <View style={styles.settingsOverlay}>
        <TouchableOpacity
          style={styles.settingsBackdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.settingsPanel}>
          <View style={styles.settingsHeader}>
            <Text style={styles.settingsTitle}>Settings</Text>
            <TouchableOpacity onPress={onClose} style={styles.settingsCloseButton}>
              <Text style={styles.settingsCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          {!loaded ? (
            <View style={styles.settingsLoadingContainer}>
              <ActivityIndicator size="large" color="#FF6B35" />
              <Text style={styles.settingsLoadingText}>Loading profile...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.settingsScroll}
              contentContainerStyle={styles.settingsScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>Technician Profile</Text>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={styles.settingsItemLabel}>First Name</Text>
                </View>
                <View style={styles.inlineInputWrapper}>
                  <TextInput value={firstName} onChangeText={setFirstName} style={styles.inlineInput} placeholder="First name" />
                </View>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={styles.settingsItemLabel}>Last Name</Text>
                </View>
                <View style={styles.inlineInputWrapper}>
                  <TextInput value={lastName} onChangeText={setLastName} style={styles.inlineInput} placeholder="Last name" />
                </View>
                <View style={styles.settingsItemNoBorder}>
                  <Text style={styles.settingsItemLabel}>Work Email</Text>
                </View>
                <View style={styles.inlineInputWrapper}>
                  <TextInput value={workEmail} onChangeText={setWorkEmail} style={styles.inlineInput} placeholder="name@company.com" autoCapitalize="none" keyboardType="email-address" />
                </View>
                {error ? <Text style={styles.settingsError}>{error}</Text> : null}
                <TouchableOpacity style={[styles.profileSaveButton, saving && { opacity:0.6 }]} onPress={handleSave} disabled={saving}>
                  <Text style={styles.profileSaveButtonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.clearProfileButton} onPress={handleClear}>
                  <Text style={styles.clearProfileButtonText}>Clear Profile</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>About</Text>
                <View style={styles.settingsItem}>
                  <Text style={styles.settingsItemLabel}>Version</Text>
                  <Text style={styles.settingsItemValue}>1.0.0</Text>
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
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#E5E7EB',
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
});
