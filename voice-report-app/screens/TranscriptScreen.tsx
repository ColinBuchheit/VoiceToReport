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
import { useFontScale } from '../context/FontScaleContext';
import Loader from '../components/Loader';
import { generateSummary } from '../services/api';
import AIAgent from '../components/AIAgent';
import { ScreenContext, FieldInfo, CloseoutSummary } from '../types/aiAgent';
import { useTheme } from '../context/ThemeContext';

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
  const { scaled } = useFontScale();
  const { colors, isDark } = useTheme();
  const [transcription, setTranscription] = useState(route.params.transcription);
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [estimateSeconds, setEstimateSeconds] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  
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
    // Heuristic progress simulation based on transcription length
    const chars = transcription ? transcription.length : 0;
    // Estimate formula: base 6s + 0.02s per character, capped to 180s (API timeout)
    const estimate = Math.min(180, Math.max(6, Math.round(chars * 0.02 + 6)));
    setEstimateSeconds(estimate);
    setElapsedSeconds(0);
    setProgressPercent(0);

    // Start simulated progress timer
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    setIsProcessing(true);

    let completed = false;
    progressInterval.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 0.5;
        // Compute progress with staged weights: upload/transcribe 15%, summarize 70%, finalize 15%
        const est = estimate;
        const raw = (() => {
          if (next <= est * 0.15) {
            return Math.round((next / (est * 0.15)) * 15);
          } else if (next <= est * 0.85) {
            return Math.round(15 + ((next - est * 0.15) / (est * 0.7)) * 70);
          } else {
            return Math.round(85 + ((next - est * 0.85) / (est * 0.15)) * 15);
          }
        })();

        // Stall at 99% until completed
        const p = completed ? raw : Math.min(99, raw);
        setProgressPercent(Math.max(0, Math.min(99, p)));
        return next;
      });
    }, 500);

    try {
      console.log('🔄 Generating summary from transcription (with heuristic):', transcription.substring(0, 100) + '...');
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

      // Immediately fill to 100% and navigate after a short visual pause
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
      setProgressPercent(100);
      // Small delay so user sees 100%
      await new Promise(res => setTimeout(res, 250));
      navigation.navigate('Summary', {
        transcription,
        summary: closeoutSummary,
      });
    } catch (error) {
      console.error('❌ Error generating summary:', error);
      Alert.alert('Error', `Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
      setEstimateSeconds(null);
      setElapsedSeconds(0);
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
        progressInterval.current = null;
      }
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

  // Progress UI while generating summary
  if (isProcessing) {
    let phase = 'Preparing';
    if (estimateSeconds) {
      const ratio = elapsedSeconds / estimateSeconds;
      if (ratio < 0.15) phase = 'Uploading & Transcribing';
      else if (ratio < 0.85) phase = 'Summarizing';
      else phase = 'Finalizing';
    }

    return (
      <View style={{flex:1, justifyContent:'center', alignItems:'center', padding:20, backgroundColor: colors.background}}>
        <View style={{width:'100%', backgroundColor: colors.surface, borderRadius:12, padding:20, alignItems:'center', elevation:2, borderWidth:1, borderColor: colors.border}}>
          <Text style={{fontSize: scaled(18), fontWeight:'600', marginBottom:8, color: colors.textPrimary}}>Generating summary</Text>
          <Text style={{color: colors.textSecondary, marginBottom:12, fontSize: scaled(14)}}>{phase}</Text>

          {/* Progress bar background */}
          <View style={{height:12, width:'100%', backgroundColor: colors.border, borderRadius:6, overflow:'hidden', marginBottom:8}}>
            <View style={{height:'100%', width:`${progressPercent}%`, backgroundColor: colors.accent}} />
          </View>

          <Text style={{fontSize: scaled(14), fontWeight:'600', marginBottom:4, color: colors.textPrimary}}>{progressPercent}%</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
  <ScrollView style={[styles.scrollContainer]} contentContainerStyle={{ paddingBottom: 180 }}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { fontSize: scaled(24), color: colors.textPrimary }]}>Voice Transcription</Text>
          <TouchableOpacity
            style={[styles.editButton, { backgroundColor: isEditing ? colors.accent : colors.surfaceAlt, borderColor: colors.border }, isEditing && { } ]}
            onPress={handleModeToggle}
          >
            <Text style={[styles.editButtonText, { fontSize: scaled(14), color: isEditing ? colors.accentContrast : colors.textPrimary }]}>
              {isEditing ? 'Done' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.transcriptionCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          {isEditing ? (
            <TextInput
              style={[styles.transcriptionInput, { fontSize: scaled(16), lineHeight: scaled(24), color: colors.textPrimary }]}
              value={transcription}
              onChangeText={(text) => {
                console.log('📝 Direct TextInput change:', text.substring(0, 50) + '...');
                setTranscription(text);
              }}
              multiline
              textAlignVertical="top"
              placeholder="Your voice recording transcription will appear here..."
              placeholderTextColor={colors.textSecondary}
            />
          ) : (
            <Text style={[styles.transcriptionText, { fontSize: scaled(16), lineHeight: scaled(24), color: colors.textPrimary }]}>
              {transcription || 'No transcription available'}
            </Text>
          )}
        </View>

        <View style={styles.actionButtons}>
          {/* Generate Button - Orange */}
          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: colors.accent }]}
            onPress={handleGenerateSummary}
            disabled={!transcription || isProcessing}
          >
            <Text style={[styles.generateButtonText, { fontSize: scaled(16), color: colors.accentContrast }]}>
              Generate Closeout
            </Text>
          </TouchableOpacity>

          {/* Clear Button - Press and Hold with Progress Bar */}
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: colors.accent }]}
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
            <Text style={[styles.clearButtonText, { fontSize: scaled(16), color: colors.accentContrast }]}>
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
        position="bottom-center"
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
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
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