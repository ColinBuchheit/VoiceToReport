import { Audio } from 'expo-av';

class AudioLockService {
  private static instance: AudioLockService;
  private isLocked = false;
  private currentOwner: string | null = null;

  static getInstance(): AudioLockService {
    if (!AudioLockService.instance) {
      AudioLockService.instance = new AudioLockService();
    }
    return AudioLockService.instance;
  }

  async acquireLock(owner: string): Promise<boolean> {
    if (this.isLocked && this.currentOwner !== owner) {
      console.warn(`🔒 Audio lock denied for ${owner} (held by ${this.currentOwner})`);
      return false;
    }
    this.isLocked = true;
    this.currentOwner = owner;
    console.log(`🔓 Audio lock acquired by ${owner}`);
    return true;
  }

  async releaseLock(owner: string): Promise<void> {
    if (this.currentOwner === owner || !this.currentOwner) {
      this.isLocked = false;
      this.currentOwner = null;
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: false,
          playThroughEarpieceAndroid: false,
          staysActiveInBackground: false,
        });
        console.log(`✅ Audio lock released by ${owner}`);
      } catch (e) {
        console.warn('Audio mode reset failed during lock release:', e);
      }
    } else {
      console.warn(`⚠️ ${owner} tried to release lock held by ${this.currentOwner}`);
    }
  }

  async forceRelease(): Promise<void> {
    console.log(`🚨 Force releasing audio lock (was held by ${this.currentOwner})`);
    this.isLocked = false;
    this.currentOwner = null;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch (e) {
      console.warn('Audio mode reset failed during force release:', e);
    }
  }

  isLockHeld(): boolean {
    return this.isLocked;
  }

  getCurrentOwner(): string | null {
    return this.currentOwner;
  }
}

export default AudioLockService.getInstance();
