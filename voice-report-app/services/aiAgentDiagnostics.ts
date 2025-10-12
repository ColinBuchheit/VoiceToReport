import { Platform, Alert } from 'react-native';
import { Audio } from 'expo-av';
import { File } from 'expo-file-system';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { AIAgentService } from './aiAgentService';
import audioLockService from './audioLockService';

export type MicDiagnostic = {
  platform: string;
  permission: string;
  statusBeforeStop?: any;
  uri?: string | null;
  fileInfo?: any;
  format?: string;
  base64Length?: number;
  error?: string;
  audioLock?: { held: boolean; owner: string | null };
  backend?: { cachedUrl: string | null; candidates: string[] };
};

export async function runAIAgentMicDiagnostic(durationMs: number = 1500): Promise<MicDiagnostic> {
  const diag: MicDiagnostic = { platform: Platform.OS, permission: 'unknown' };
  const svc = AIAgentService.getInstance();
  try {
    // Include audio lock state and backend info up front
    try {
      diag.audioLock = { held: audioLockService.isLockHeld(), owner: audioLockService.getCurrentOwner() } as any;
    } catch {}
    try {
      const b = svc.getBackendDebugInfo();
      diag.backend = { cachedUrl: b.cachedUrl, candidates: b.candidates };
    } catch {}
    const perm = await Audio.getPermissionsAsync();
    diag.permission = perm.status;
    if (perm.status !== 'granted') {
      const req = await Audio.requestPermissionsAsync();
      diag.permission = req.status;
      if (req.status !== 'granted') {
        throw new Error('Permission not granted');
      }
    }

    const rec = await svc.startListening();
    await new Promise((r) => setTimeout(r, durationMs));
    try {
      const st = await rec.getStatusAsync();
      diag.statusBeforeStop = st;
    } catch {}
    const uri = await svc.stopListening();
    diag.uri = uri;
    if (!uri) {
      return diag;
    }

    try {
      const file = new File(uri);
      diag.format = (file.name.split('.').pop() || '').toLowerCase();
    } catch {}

    try {
      const info = await FileSystemLegacy.getInfoAsync(uri);
      diag.fileInfo = info;
    } catch (e: any) {
      diag.fileInfo = { error: e?.message || String(e) };
    }

    try {
      const b64 = await FileSystemLegacy.readAsStringAsync(uri, { encoding: FileSystemLegacy.EncodingType.Base64 });
      diag.base64Length = b64.length;
    } catch (e: any) {
      diag.error = `readAsString failed: ${e?.message || e}`;
    }

    return diag;
  } catch (e: any) {
    diag.error = e?.message || String(e);
    return diag;
  }
}

export function showMicDiagnostic(diag: MicDiagnostic) {
  const size = typeof diag.fileInfo?.size === 'number' ? `${diag.fileInfo.size} bytes` : 'n/a';
  const dur = typeof diag.statusBeforeStop?.durationMillis === 'number' ? `${diag.statusBeforeStop.durationMillis} ms` : 'n/a';
  const b64 = typeof diag.base64Length === 'number' ? `${diag.base64Length}` : 'n/a';
  const uri = diag.uri || 'null';
  const lock = diag.audioLock ? `\nLock: held=${diag.audioLock.held} owner=${diag.audioLock.owner || 'none'}` : '';
  const backend = diag.backend ? `\nBackend: ${diag.backend.cachedUrl || 'none'}\nCandidates: ${(diag.backend.candidates || []).join(', ')}` : '';
  const msg = `Platform: ${diag.platform}\nPerm: ${diag.permission}\nDur: ${dur}\nURI: ${uri}\nSize: ${size}\nB64 len: ${b64}\nFmt: ${diag.format || 'n/a'}\nErr: ${diag.error || 'none'}${lock}${backend}`;
  Alert.alert('AI Mic Diagnostic', msg);
  // Also log detailed object
  // eslint-disable-next-line no-console
  console.log('[AI Mic Diagnostic]', JSON.stringify(diag, null, 2));
}
