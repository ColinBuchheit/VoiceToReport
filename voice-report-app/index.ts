import { registerRootComponent } from 'expo';

import App from './App';
import { clearBackendCache, testBackendConnection } from './services/api';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Ensure we don't stick to a stale local backend between app restarts, and log the active server
try {
	clearBackendCache();
	// Fire and forget; just for logging/verification
	setTimeout(() => {
		testBackendConnection();
	}, 0);
} catch {}
