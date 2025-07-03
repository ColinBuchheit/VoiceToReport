// Updated HomeScreen with BearS&T theming (black, white, orange)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import Recorder from '../components/Recorder';
import { transcribeAudio } from '../services/api';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: Props) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRecordingComplete = async (audioUri: string) => {
    try {
      setIsProcessing(true);
      const result = await transcribeAudio(audioUri);
      
      navigation.navigate('Transcript', {
        transcription: result.transcription,
        audioUri,
      });
    } catch (error) {
      console.error('Error processing audio:', error);
      Alert.alert('Error', 'Failed to process audio recording');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <Image 
            source={require('../assets/bears&t.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        {/* Recorder Section */}
        <View style={styles.recorderSection}>
          <Recorder
            onRecordingComplete={handleRecordingComplete}
            isProcessing={isProcessing}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center', // Better centering
    paddingTop: 60,
    paddingBottom: 40,
    width: '100%', // Full width for proper centering
  },
  logoImage: {
    width: 300,
    height: 120,
    marginBottom: 20,
    alignSelf: 'center', // Ensure center alignment
  },
  recorderSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 60, // Add some bottom padding since instructions are removed
  },
});