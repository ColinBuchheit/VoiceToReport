// voice-report-app/App.tsx - FIXED VERSION with correct type imports
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import TranscriptScreen from './screens/TranscriptScreen';
import SummaryScreen from './screens/SummaryScreen';
import { CloseoutSummary } from './types/aiAgent'; // FIXED: Import from correct types file

// Navigation types to match API structure
export type RootStackParamList = {
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

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" />
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#FF6B35',
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{ title: 'Voice Report' }}
          />
          <Stack.Screen 
            name="Transcript" 
            component={TranscriptScreen} 
            options={{ title: 'Transcription' }}
          />
          <Stack.Screen 
            name="Summary" 
            component={SummaryScreen} 
            options={{ title: 'Summary' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}