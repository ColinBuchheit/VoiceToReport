// voice-report-app/screens/TranscriptScreen.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useMemo } from 'react';
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
import { ScreenContext, FieldInfo, CloseoutSummary } from '../types/aiAgent';

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

  // FIXED: Enhanced screen context with comprehensive field mapping
  const screenContext = useMemo((): ScreenContext => {
    const fields: FieldInfo[] = [
      {
        name: 'transcription',
        label: 'Transcription Text', // This matches what backend sends
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
          'spoken text',
          'text',
          'recording text',
          'transcription text', // Key synonym for backend mapping
          'voice text',
          'audio text',
          'speech text'
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
        'edit transcription',
        'stop editing',
        'generate closeout summary',
        'clear transcription'
      ],
      mode: isEditing ? 'edit' : 'preview',
      agentCapabilities: [
        'field_updates',
        'wording_help', 
        'questions',
        'voice_control',
        'context_aware'
      ],
      timestamp: new Date().toISOString(),
    };
  }, [transcription, isEditing]);

  // Enhanced debugging for state changes
  useEffect(() => {
    console.log('🔄 TranscriptScreen state updated:', {
      transcription: transcription?.substring(0, 50) + '...',
      isEditing,
      transcriptionLength: transcription?.length || 0
    });
  }, [transcription, isEditing]);

  // Debug the screen context
  useEffect(() => {
    console.log('🔍 TranscriptScreen context:', {
      screenName: screenContext.screenName,
      fieldsCount: screenContext.visibleFields.length,
      mode: screenContext.mode,
      hasTranscriptionField: screenContext.visibleFields.some(f => f.name === 'transcription'),
      transcriptionFieldEditable: screenContext.visibleFields.find(f => f.name === 'transcription')?.isEditable
    });
  }, [screenContext]);

  const handleGenerateSummary = async () => {
    try {
      setIsProcessing(true);
      console.log('🔄 Generating summary from transcription:', transcription.substring(0, 100) + '...');
      
      const response = await generateSummary(transcription);
      console.log('📥 Raw API response:', response);
      
      // Handle the CloseoutSummary response format correctly
      let closeoutSummary: CloseoutSummary;
      
      if (response && typeof response === 'object' && 'summary' in response) {
        // The API returns { summary: CloseoutSummary }
        closeoutSummary = (response as any).summary;
        console.log('✅ Using CloseoutSummary from response.summary');
      } else {
        // Fallback: treat response as CloseoutSummary directly
        closeoutSummary = response as CloseoutSummary;
        console.log('✅ Using response as CloseoutSummary directly');
      }
      
      console.log('📋 Extracted closeout summary:', closeoutSummary);
      
      // Navigate to Summary screen
      navigation.navigate('Summary', {
        transcription,
        summary: closeoutSummary,
      });
      
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      Alert.alert(
        'Error', 
        `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // FIXED: Enhanced handleFieldUpdate with comprehensive field mapping
  const handleFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🔄 handleFieldUpdate called: ${fieldName} = "${value}"`);
    
    // FIXED: Add comprehensive field name mapping to handle all possible formats
    const fieldMapping: Record<string, string> = {
      // Transcription field variations
      'transcription': 'transcription',
      'transcript': 'transcription', 
      'recording': 'transcription',
      'text': 'transcription',
      'transcription text': 'transcription',  // ← KEY: Handles "Transcription Text" from backend
      'recording text': 'transcription',
      'voice recording': 'transcription',
      'spoken text': 'transcription',
      'voice text': 'transcription',
      'audio text': 'transcription',
      'speech text': 'transcription',
      'the text': 'transcription',
      'what i said': 'transcription',
      
      // Edit mode variations
      'isediting': 'isEditing',
      'is_editing': 'isEditing', 
      'edit_mode': 'isEditing',
      'editing': 'isEditing',
      'edit': 'isEditing'
    };

    // Normalize field name to lowercase for matching
    const normalizedFieldName = fieldName.toLowerCase().trim();
    const actualFieldName = fieldMapping[normalizedFieldName] || normalizedFieldName;
    
    console.log(`🔄 Field mapping: "${fieldName}" → "${actualFieldName}"`);
    
    if (actualFieldName === 'transcription') {
      console.log('📝 Updating transcription state...');
      setTranscription(value);
      console.log('✅ setTranscription called with:', value.substring(0, 50) + '...');
    } else if (actualFieldName === 'isEditing') {
      console.log('📝 Updating editing mode...');
      // Handle both string and boolean values properly
      const newEditingState = typeof value === 'boolean' ? value : value === 'true';
      setIsEditing(newEditingState);
      console.log('✅ setIsEditing called with:', newEditingState);
    } else {
      console.warn(`⚠️ Unknown field update: ${fieldName} (mapped to: ${actualFieldName})`);
      console.log('📋 Available mappings:', Object.keys(fieldMapping));
      console.log('📋 All variations tried:', [fieldName, normalizedFieldName, actualFieldName]);
    }
  };

  // FIXED: Enhanced handleModeToggle with logging
  const handleModeToggle = () => {
    console.log('🔄 handleModeToggle called, current editing state:', isEditing);
    const newEditingState = !isEditing;
    setIsEditing(newEditingState);
    console.log('✅ Mode toggled to:', newEditingState ? 'edit' : 'preview');
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
              onChangeText={(text) => {
                console.log('📝 TextInput onChangeText called with:', text.substring(0, 50) + '...');
                setTranscription(text);
              }}
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
            onPress={() => {
              console.log('🔄 Clear button pressed');
              setTranscription('');
            }}
          >
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* FIXED: AI Agent with proper context and enhanced callbacks */}
      <AIAgent
        screenContext={screenContext}
        onFieldUpdate={handleFieldUpdate}
        onModeToggle={handleModeToggle}
        onAction={(action) => {
          console.log('🎯 AIAgent action triggered:', action);
          if (action === 'generate_summary' || action === 'generate closeout summary') {
            handleGenerateSummary();
          } else if (action === 'clear_transcription' || action === 'clear transcription') {
            setTranscription('');
          }
        }}
        position="bottom-right"
        showDebugInfo={false}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  editButton: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  editButtonActive: {
    backgroundColor: '#3498db',
  },
  editButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: '#ffffff',
  },
  transcriptionCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 200,
  },
  transcriptionInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
    textAlignVertical: 'top',
    minHeight: 160,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  generateButton: {
    flex: 1,
    backgroundColor: '#27ae60',
    paddingVertical: 15,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});