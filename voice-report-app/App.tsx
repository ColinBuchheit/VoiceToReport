import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'react-native';

import HomeScreen from './screens/HomeScreen';
import TranscriptScreen from './screens/TranscriptScreen';
import SummaryScreen from './screens/SummaryScreen';
import PDFPreviewScreen from './screens/PDFPreviewScreen';

export type RootStackParamList = {
  Home: undefined;
  Transcript: {
    transcription: string;
    audioUri?: string;
  };
  Summary: {
    transcription: string;
    summary: {
      taskDescription: string;
      location?: string;
      datetime?: string;
      outcome?: string;
      notes?: string;
    };
  };
  PDFPreview: {
    pdfUrl: string;
    summary: any;
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
          <Stack.Screen 
            name="PDFPreview" 
            component={PDFPreviewScreen} 
            options={{ title: 'PDF Report' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </>
  );
}