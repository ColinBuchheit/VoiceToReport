import { Audio } from 'expo-av';

type LockOwner = string | undefined;

class AudioLockService {
	private lockHeld = false;
	private owner: LockOwner = undefined;

	async acquireLock(owner: string): Promise<boolean> {
		if (this.lockHeld) {
			console.log(`🎙️ Audio lock already held by '${this.owner}'. '${owner}' cannot acquire.`);
			return false;
		}
		this.lockHeld = true;
		this.owner = owner;
		console.log(`🔒 Audio lock acquired by '${owner}'.`);
		return true;
	}

	async releaseLock(owner: string): Promise<void> {
		if (!this.lockHeld) {
			return;
		}
		if (this.owner && this.owner !== owner) {
			console.warn(`⚠️ '${owner}' attempted to release audio lock owned by '${this.owner}'. Forcing release.`);
		}
		this.lockHeld = false;
		this.owner = undefined;
		try {
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: false,
				playsInSilentModeIOS: false,
				shouldDuckAndroid: false,
				playThroughEarpieceAndroid: false,
				staysActiveInBackground: false,
			});
			console.log('🔓 Audio lock released and audio mode reset.');
		} catch (e) {
			console.warn('Audio mode reset on release failed (non-fatal):', e);
		}
	}

	async forceRelease(): Promise<void> {
		if (!this.lockHeld) return;
		console.log(`🛑 Force releasing audio lock (was owned by '${this.owner || 'unknown'}').`);
		this.lockHeld = false;
		this.owner = undefined;
		try {
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: false,
				playsInSilentModeIOS: false,
				shouldDuckAndroid: false,
				playThroughEarpieceAndroid: false,
				staysActiveInBackground: false,
			});
		} catch (e) {
			console.warn('Audio mode reset on forceRelease failed (non-fatal):', e);
		}
	}

	isLockHeld(): boolean {
		return this.lockHeld;
	}

	getCurrentOwner(): LockOwner {
		return this.owner;
	}
}

export const audioLockService = new AudioLockService();
export default audioLockService;

