import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
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
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Report</Text>
          <Text style={styles.subtitle}>
            Record your daily accomplishments and we'll generate a professional report
          </Text>
        </View>

        <View style={styles.recorderSection}>
          <Recorder
            onRecordingComplete={handleRecordingComplete}
            isProcessing={isProcessing}
          />
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            Press and hold to record, release to stop
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  recorderSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructions: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  instructionText: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});