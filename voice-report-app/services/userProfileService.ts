// voice-report-app/services/userProfileService.ts
// Manages persisted technician/work email profile information
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UserProfile {
  workEmail: string;
  firstName: string;
  lastName: string;
}

const STORAGE_KEY = 'user_profile_v1';

function normalizeEmail(email: string) {
  return email.trim();
}

export function fullName(profile?: UserProfile | null): string {
  if (!profile) return '';
  return [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim();
}

async function getProfile(): Promise<UserProfile | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return null;
    const data = JSON.parse(json);
    if (!data || !data.workEmail) return null;
    return {
      workEmail: normalizeEmail(data.workEmail),
      firstName: data.firstName || '',
      lastName: data.lastName || '',
    };
  } catch (e) {
    console.warn('Failed to load user profile', e);
    return null;
  }
}

async function saveProfile(profile: UserProfile): Promise<void> {
  try {
    const cleaned: UserProfile = {
      workEmail: normalizeEmail(profile.workEmail),
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch (e) {
    console.warn('Failed to save user profile', e);
    throw e;
  }
}

async function hasProfile(): Promise<boolean> {
  const profile = await getProfile();
  return !!(profile && profile.workEmail && fullName(profile));
}

async function clearProfile(): Promise<void> {
  try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
}

export default {
  getProfile,
  saveProfile,
  hasProfile,
  clearProfile,
  fullName,
};
