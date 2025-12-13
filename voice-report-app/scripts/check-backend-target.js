#!/usr/bin/env node
/**
 * Prints which backend URL(s) the mobile app will target for a given EAS build profile
 * and optionally probes /health for each to verify reachability.
 *
 * Usage (Windows cmd.exe):
 *   node scripts\check-backend-target.js preview
 *   node scripts\check-backend-target.js production --probe
 */
const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const profile = (process.argv[2] || 'preview').trim();
const doProbe = process.argv.includes('--probe');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function extractBackendUrlsFromApiConfig(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  const m = src.match(/BACKEND_URLS:\s*\[([\s\S]*?)\]/);
  if (!m) return [];
  const inner = m[1];
  const urls = [];
  const re = /'([^']+)'/g;
  let g;
  while ((g = re.exec(inner))) urls.push(g[1]);
  return urls;
}

function getEnvUrlsFromEas(eas, profile) {
  const env = (eas.build && eas.build[profile] && eas.build[profile].env) || {};
  const list = [];
  if (env.EXPO_PUBLIC_BACKEND_URLS && String(env.EXPO_PUBLIC_BACKEND_URLS).trim()) {
    String(env.EXPO_PUBLIC_BACKEND_URLS)
      .split(/[\s,]+/)
      .filter(Boolean)
      .forEach((u) => list.push(u.replace(/\/$/, '')));
  }
  if (env.EXPO_PUBLIC_BACKEND_URL && String(env.EXPO_PUBLIC_BACKEND_URL).trim()) {
    list.push(String(env.EXPO_PUBLIC_BACKEND_URL).trim().replace(/\/$/, ''));
  }
  return list;
}

async function probeHealth(url) {
  const target = url.replace(/\/$/, '') + '/health';
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(target, { signal: controller.signal, headers: { 'ngrok-skip-browser-warning': 'true' } });
    clearTimeout(t);
    return res.ok ? 'OK' : 'HTTP ' + res.status;
  } catch (e) {
    clearTimeout(t);
    return 'ERROR ' + (e && e.message ? e.message : String(e));
  }
}

(async () => {
  try {
    const easPath = path.join(appDir, 'eas.json');
    const apiConfigPath = path.join(appDir, 'services', 'api-config.ts');
    const eas = readJson(easPath);
  const envUrls = getEnvUrlsFromEas(eas, profile);
  const aiDebug = (eas.build && eas.build[profile] && eas.build[profile].env && eas.build[profile].env.EXPO_PUBLIC_AI_DEBUG) || '(not set)';
    const defaultUrls = extractBackendUrlsFromApiConfig(apiConfigPath);

    console.log('Profile:', profile);
    console.log('Env URLs (from EAS profile):', envUrls.length ? envUrls : '(none)');
  console.log('AI debug flag (from EAS profile):', aiDebug);
    console.log('Default URLs (from api-config.ts):', defaultUrls);

    const effective = envUrls.length ? envUrls : defaultUrls;
    console.log('Effective URLs (will be used):', effective);

    if (doProbe) {
      console.log('\nProbing /health on effective URLs...');
      for (const u of effective) {
        const res = await probeHealth(u);
        console.log('-', u, '->', res);
      }
    }
  } catch (e) {
    console.error('check-backend-target failed:', e);
    process.exit(1);
  }
})();
