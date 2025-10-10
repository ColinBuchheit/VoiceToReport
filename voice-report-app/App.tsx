// voice-report-app/App.tsx - FIXED VERSION with correct type imports
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, DarkTheme, Theme as NavTheme } from '@react-navigation/native';
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
import { ThemeProvider, useTheme } from './context/ThemeContext';

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
  /** When true, Summary screen will automatically trigger email send on mount */
  autoSendEmail?: boolean;
  /** When present, Summary edits refer to an existing draft to be updated (upsert) */
  draftId?: string;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  // Call theme hook first so hook order is stable across renders
  const { colors } = useTheme();
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
      <View style={{ flex:1, justifyContent:'center', alignItems:'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRoute as any}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Voice Report' }} />
      <Stack.Screen name="Transcript" component={TranscriptScreen} options={{ title: 'Transcription' }} />
      <Stack.Screen name="Summary" component={SummaryScreen} options={{ title: 'Summary' }} />
    </Stack.Navigator>
  );
}

function ThemedAppRoot() {
  const { resolvedMode, colors } = useTheme();
  const baseNav = resolvedMode === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme: NavTheme = {
    dark: resolvedMode === 'dark',
    colors: {
      ...baseNav.colors,
      background: colors.background,
      card: colors.surface,
      border: colors.border,
      text: colors.textPrimary,
      primary: colors.accent,
      notification: colors.accent,
    },
  fonts: (baseNav as any).fonts || {},
  } as NavTheme;
  return (
    <FontScaleProvider>
      <StatusBar barStyle={resolvedMode === 'dark' ? 'light-content' : 'dark-content'} />
      <NavigationContainer theme={navTheme}>
        <AppNavigator />
      </NavigationContainer>
    </FontScaleProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedAppRoot />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}