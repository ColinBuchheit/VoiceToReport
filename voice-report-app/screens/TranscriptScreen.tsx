// screens/TranscriptScreen.tsx - FIXED FOR CLOSEOUT COMPATIBILITY
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
import AIAgent from '../components/AIAgent';
import { ScreenContext, FieldInfo } from '../types/aiAgent';

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

  // Enhanced screen context for AI
  const getEnhancedScreenContext = (): ScreenContext => {
    const fields: FieldInfo[] = [
      {
        name: 'transcription',
        label: 'Transcription Text',
        currentValue: transcription || '',
        type: 'multiline',
        isEditable: isEditing,
        synonyms: [
          'transcription', 
          'transcript', 
          'recording', 
          'what I said', 
          'the text',
          'voice recording',
          'spoken text'
        ],
        placeholder: 'Your voice recording will appear here...',
      },
    ];

    return {
      screenName: 'transcript',
      visibleFields: fields,
      currentValues: {
        transcription,
        isEditing,
      },
      availableActions: [
        'toggle_edit_mode',
        'generate_summary',
        'clear_transcription',
        'suggest_improvements',
        'make_professional',
      ],
      mode: isEditing ? 'edit' : 'preview',
    };
  };

  const handleGenerateSummary = async () => {
    try {
      setIsProcessing(true);
      const response = await generateSummary(transcription);
      
      // The API returns legacy format, so use it directly
      const legacySummary = {
        taskDescription: response.summary.taskDescription || '',
        location: response.summary.location || '',
        datetime: response.summary.datetime || '',
        outcome: response.summary.outcome || '',
        notes: response.summary.notes || ''
      };
      
      navigation.navigate('Summary', {
        transcription,
        summary: legacySummary,
      });
    } catch (error) {
      console.error('Error generating summary:', error);
      Alert.alert('Error', 'Failed to generate summary');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFieldUpdate = (fieldName: string, value: string) => {
    if (fieldName === 'transcription') {
      setTranscription(value);
    }
  };

  const handleModeToggle = () => {
    setIsEditing(!isEditing);
  };

  if (isProcessing) {
    return <Loader message="Generating summary..." />;
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Voice Transcription</Text>
          <TouchableOpacity
            style={[styles.editButton, isEditing && styles.editButtonActive]}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}>
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
              placeholder="Your voice recording transcription will appear here..."
            />
          ) : (
            <Text style={styles.transcriptionText}>
              {transcription || 'No transcription available'}
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.generateButton}
            onPress={handleGenerateSummary}
            disabled={!transcription || isProcessing}
          >
            <Text style={styles.generateButtonText}>
              Generate Closeout Summary
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setTranscription('')}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* AI VOICE ASSISTANT */}
      <AIAgent
        screenContext={getEnhancedScreenContext()}
        onFieldUpdate={handleFieldUpdate}
        onModeToggle={handleModeToggle}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    flex: 1,
  },
  editButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  editButtonActive: {
    backgroundColor: '#27ae60',
  },
  editButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  editButtonTextActive: {
    color: 'white',
  },
  transcriptionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  transcriptionInput: {
    fontSize: 16,
    color: '#2c3e50',
    minHeight: 200,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
  },
  transcriptionText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 24,
    minHeight: 200,
  },
  actionButtons: {
    marginBottom: 20,
  },
  generateButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: '#95a5a6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});