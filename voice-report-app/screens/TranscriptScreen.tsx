// Updated TranscriptScreen with BearS&T theming
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import Loader from '../components/Loader';
import { generateSummary } from '../services/api';

type TranscriptScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Transcript'
>;
type TranscriptScreenRouteProp = RouteProp<RootStackParamList, 'Transcript'>;

interface Props {
  navigation: TranscriptScreenNavigationProp;
  route: TranscriptScreenRouteProp;
}

export default function TranscriptScreen({ navigation, route }: Props) {
  const [transcription, setTranscription] = useState(route.params.transcription);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerateSummary = async () => {
    try {
      setIsProcessing(true);
      const result = await generateSummary(transcription);
      
      navigation.navigate('Summary', {
        transcription,
        summary: result.summary,
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      Alert.alert('Error', 'Failed to generate summary');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isProcessing) {
    return <Loader message="Generating AI summary..." />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Transcription</Text>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transcriptionCard}>
          {isEditing ? (
            <TextInput
              style={styles.transcriptionInput}
              value={transcription}
              onChangeText={setTranscription}
              multiline
              textAlignVertical="top"
            />
          ) : (
            <Text style={styles.transcriptionText}>{transcription}</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleGenerateSummary}
        >
          <Text style={styles.continueButtonText}>Generate Summary</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#000000', // Black text
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F5F5F5', // Light gray background
  },
  editButtonText: {
    color: '#FF6B35', // Orange text
    fontSize: 16,
    fontWeight: '500',
  },
  transcriptionCard: {
    backgroundColor: '#F8F9FA', // Very light gray background
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    minHeight: 300,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  transcriptionText: {
    fontSize: 16,
    color: '#000000', // Black text
    lineHeight: 24,
  },
  transcriptionInput: {
    fontSize: 16,
    color: '#000000', // Black text
    lineHeight: 24,
    minHeight: 250,
  },
  continueButton: {
    backgroundColor: '#FF6B35', // Orange background
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  continueButtonText: {
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: '600',
  },
});