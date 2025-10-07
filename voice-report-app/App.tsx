// voice-report-app/App.tsx - FIXED VERSION with correct type imports
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import TranscriptScreen from './screens/TranscriptScreen';
import SummaryScreen from './screens/SummaryScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import userProfileService from './services/userProfileService';
import { ActivityIndicator, View } from 'react-native';
import { CloseoutSummary } from './types/aiAgent'; // FIXED: Import from correct types file
import { FontScaleProvider } from './context/FontScaleContext';

// Navigation types to match API structure
export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Transcript: {
    transcription: string;
    audioUri?: string;
  };
  Summary: {
    transcription: string;
    summary: CloseoutSummary;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const [initialRoute, setInitialRoute] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const has = await userProfileService.hasProfile();
        setInitialRoute(has ? 'Home' : 'Onboarding');
      } catch {
        setInitialRoute('Onboarding');
      }
    })();
  }, []);

  if (!initialRoute) {
    return (
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'#fff' }}>
        <ActivityIndicator size="large" color="#FF6B35" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute as any}
      screenOptions={{
        headerStyle: { backgroundColor: '#ffffff' },
        headerTintColor: '#FF6B35',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Voice Report' }} />
      <Stack.Screen name="Transcript" component={TranscriptScreen} options={{ title: 'Transcription' }} />
      <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Summary' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <FontScaleProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </FontScaleProvider>
    </SafeAreaProvider>
  );
}