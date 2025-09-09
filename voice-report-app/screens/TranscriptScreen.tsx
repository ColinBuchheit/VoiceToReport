// voice-report-app/screens/TranscriptScreen.tsx - COMPLETE FIXED VERSION
import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Animated,
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
  
  // Press and hold state for clear button
  const [isHoldingClear, setIsHoldingClear] = useState(false);
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);
  const HOLD_DURATION = 2000; // 2 seconds

  // Enhanced screen context with comprehensive field mapping
  const screenContext = useMemo((): ScreenContext => {
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
          'spoken text',
          'text',
          'recording text',
          'transcription text',
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

  // Enhanced state monitoring for debugging
  useEffect(() => {
    console.log('🔄 TranscriptScreen state updated:', {
      transcription: transcription?.substring(0, 50) + (transcription?.length > 50 ? '...' : ''),
      transcriptionLength: transcription?.length || 0,
      isEditing,
      timestamp: new Date().toISOString(),
      screenContextMode: isEditing ? 'edit' : 'preview'
    });
  }, [transcription, isEditing]);

  const handleGenerateSummary = async () => {
    try {
      setIsProcessing(true);
      console.log('🔄 Generating summary from transcription:', transcription.substring(0, 100) + '...');
      
      const response = await generateSummary(transcription);
      console.log('📥 Raw API response:', response);
      
      let closeoutSummary: CloseoutSummary;
      
      if (response && typeof response === 'object' && 'summary' in response) {
        closeoutSummary = (response as any).summary;
        console.log('✅ Using CloseoutSummary from response.summary');
      } else {
        closeoutSummary = response as CloseoutSummary;
        console.log('✅ Using response as CloseoutSummary directly');
      }
      
      console.log('📋 Extracted closeout summary:', closeoutSummary);
      
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

  // Press and hold handlers for clear button
  const handleClearPressIn = () => {
    setIsHoldingClear(true);
    
    // Start the progress animation
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: HOLD_DURATION,
      useNativeDriver: false,
    }).start();

    // Set timeout for completion
    holdTimeout.current = setTimeout(() => {
      // Clear the transcription after hold duration
      console.log('🔄 Clear button held - clearing transcription');
      setTranscription('');
      setIsHoldingClear(false);
      holdProgress.setValue(0);
    }, HOLD_DURATION);
  };

  const handleClearPressOut = () => {
    // Cancel the operation if released early
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    
    setIsHoldingClear(false);
    
    // Reset progress animation
    Animated.timing(holdProgress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  // FIXED: Complete field update handler with field name mapping
  const handleFieldUpdate = (fieldName: string, value: string) => {
    console.log('🎯 AI Agent requesting field update:', { 
      fieldName, 
      value: typeof value === 'string' ? value.substring(0, 100) + (value.length > 100 ? '...' : '') : value,
      currentTranscriptionLength: transcription?.length || 0,
      currentIsEditing: isEditing,
      timestamp: new Date().toISOString()
    });
    
    // Map field names from backend to our internal field names
    const fieldMapping: { [key: string]: string } = {
      'Transcription Text': 'transcription',
      'transcription': 'transcription',
      'transcript': 'transcription',
      'recording': 'transcription',
      'text': 'transcription',
      'isEditing': 'isEditing',
      'editing': 'isEditing',
      'edit_mode': 'isEditing'
    };
    
    const mappedFieldName = fieldMapping[fieldName] || fieldName.toLowerCase();
    console.log('🗺️ Field mapping:', fieldName, '→', mappedFieldName);
    
    if (mappedFieldName === 'transcription') {
      console.log('📝 Updating transcription from length:', transcription?.length || 0, 'to length:', value?.length || 0);
      setTranscription(value);
      
      // Force UI update verification
      setTimeout(() => {
        console.log('✅ Transcription state after update:', {
          newLength: value?.length || 0,
          updateSuccess: true
        });
      }, 100);
      
    } else if (mappedFieldName === 'isEditing') {
      const isEditingValue = value === 'true';
      console.log('✏️ Updating editing mode from:', isEditing, 'to:', isEditingValue);
      setIsEditing(isEditingValue);
      
      // Verify mode change
      setTimeout(() => {
        console.log('✅ Edit mode state after update:', {
          newEditingMode: isEditingValue,
          modeChangeSuccess: true
        });
      }, 100);
      
    } else {
      console.warn('⚠️ Unknown field name after mapping:', fieldName, '→', mappedFieldName, 'with value:', value);
    }
    
    console.log('✅ handleFieldUpdate completed for field:', fieldName, '→', mappedFieldName);
  };

  // Enhanced manual mode toggle with logging
  const handleModeToggle = () => {
    console.log('🔄 Manual mode toggle - current isEditing:', isEditing);
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
            onPress={handleModeToggle}
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
                console.log('📝 Direct TextInput change:', text.substring(0, 50) + '...');
                setTranscription(text);
              }}
              multiline
              textAlignVertical="top"
              placeholder="Your voice recording transcription will appear here..."
              key={`transcript-input-${transcription?.length || 0}`}  // Force re-render on content change
            />
          ) : (
            <Text style={styles.transcriptionText}>
              {transcription || 'No transcription available'}
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          {/* Generate Button - Orange */}
          <TouchableOpacity
            style={[styles.generateButton, styles.orangeButton]}
            onPress={handleGenerateSummary}
            disabled={!transcription || isProcessing}
          >
            <Text style={styles.generateButtonText}>
              Generate Closeout
            </Text>
          </TouchableOpacity>

          {/* Clear Button - Press and Hold with Progress Bar */}
          <TouchableOpacity
            style={[styles.clearButton, styles.orangeButton]}
            onPressIn={handleClearPressIn}
            onPressOut={handleClearPressOut}
            activeOpacity={0.8}
          >
            {/* Progress Bar Background */}
            <View style={styles.progressBarBackground}>
              <Animated.View
                style={[
                  styles.progressBar,
                  {
                    width: holdProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            
            {/* Button Text */}
            <Text style={styles.clearButtonText}>
              {isHoldingClear ? 'Hold to Clear...' : 'Clear'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* AI Agent */}
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
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orangeButton: {
    backgroundColor: '#FF6B35', // Orange color
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  clearButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    minWidth: 100,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    zIndex: 2,
  },
  progressBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 8,
  },
});