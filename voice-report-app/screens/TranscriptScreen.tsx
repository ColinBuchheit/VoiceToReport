// voice-report-app/screens/TranscriptScreen.tsx - FIXED VERSION with working voice AI
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

  // FIXED: Create enhanced context that matches what works in SummaryScreen
  const screenContext = useMemo((): ScreenContext => {
    const fields: FieldInfo[] = [
      {
        name: 'transcription', // FIXED: Use simple name that matches mapping
        label: 'Transcription Text', // Backend maps this label to the name
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
          'transcription text' // FIXED: Add the label as a synonym
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

  // FIXED: Enhanced handleFieldUpdate with proper state management and logging
  const handleFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🔄 handleFieldUpdate called: ${fieldName} = "${value}"`);
    
    if (fieldName === 'transcription') {
      console.log('📝 Updating transcription state...');
      setTranscription(value);
      console.log('✅ setTranscription called with:', value.substring(0, 50) + '...');
    } else if (fieldName === 'isEditing') {
      console.log('📝 Updating editing mode...');
      const newEditingState = value === 'true';
      setIsEditing(newEditingState);
      console.log('✅ setIsEditing called with:', newEditingState);
    } else {
      console.warn(`⚠️ Unknown field update: ${fieldName}`);
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

      {/* FIXED: AI Agent with proper context */}
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
    backgroundColor: '#FF6B35',
  },
  editButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  editButtonTextActive: {
    color: '#ffffff',
  },
  transcriptionCard: {
    backgroundColor: '#f8f9fa',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
    textAlign: 'left',
  },
  transcriptionInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#2c3e50',
    minHeight: 160,
    textAlign: 'left',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  generateButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 10,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 0.4,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});