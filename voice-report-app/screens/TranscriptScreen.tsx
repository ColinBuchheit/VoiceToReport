// screens/TranscriptScreen.tsx - Complete Enhanced with Bear AI Capabilities
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

  // Enhanced screen context for Bear AI
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
      // NEW: Enhanced fields for Bear AI
      agentCapabilities: [
        'field_updates',
        'wording_help',
        'questions',
        'voice_control',
        'context_aware',
      ],
      timestamp: new Date().toISOString(),
    };
  };

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

  // NEW: AI Agent callback functions
  const handleAIFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🤖 Bear AI updating field: ${fieldName} = ${value}`);
    
    if (fieldName === 'transcription') {
      setTranscription(value);
      
      Alert.alert(
        'Transcription Updated',
        'Bear AI has updated your transcription text.',
        [{ text: 'OK' }],
        { cancelable: true }
      );
    }
  };

  const handleAIModeToggle = () => {
    const newMode = !isEditing;
    console.log(`🤖 Bear AI toggling edit mode to: ${newMode}`);
    setIsEditing(newMode);
    
    Alert.alert(
      'Edit Mode Changed',
      `Bear switched to ${newMode ? 'edit' : 'preview'} mode.`,
      [{ text: 'OK' }],
      { cancelable: true }
    );
  };

  const handleAIAction = (actionName: string, params?: any) => {
    console.log(`🤖 Bear AI executing action: ${actionName}`, params);
    
    switch (actionName) {
      case 'generate_summary':
        handleGenerateSummary();
        break;
      case 'clear_transcription':
        Alert.alert(
          'Clear Transcription',
          'Are you sure you want to clear all transcription text?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Clear', 
              style: 'destructive',
              onPress: () => setTranscription('')
            }
          ]
        );
        break;
      case 'suggest_improvements':
        handleSuggestImprovements();
        break;
      case 'make_professional':
        handleMakeProfessional();
        break;
      default:
        Alert.alert('Action', `Bear executed: ${actionName}`);
    }
  };

  // NEW: Handle capability explanations
  const handleCapabilityExplain = (capability: string) => {
    console.log(`🤖 Bear explaining capability: ${capability}`);
    
    const explanations = {
      field_updates: "I can help you edit and improve your transcription text. Just say 'change the transcription to...' or 'update the text'.",
      wording_help: "I can make your transcription sound more professional. Ask me 'how does this sound?' or 'make this more professional'.",
      questions: "You can ask me what I can do, or just chat about improving your transcription.",
      voice_control: "I work hands-free! Perfect when you want to edit text without typing.",
      context_aware: "I understand you're working on your transcription and can help make it better."
    };
    
    const explanation = explanations[capability as keyof typeof explanations] || 
      "I'm Bear, your AI assistant for improving transcriptions and reports!";
    
    Alert.alert(
      'Bear AI Capabilities',
      explanation,
      [{ text: 'Got it, thanks!' }]
    );
  };

  // NEW: Handle suggestions from Bear
  const handleSuggestionProvided = (suggestion: string, targetField?: string) => {
    console.log(`🤖 Bear suggesting for ${targetField}: ${suggestion}`);
    
    if (targetField === 'transcription') {
      Alert.alert(
        'Transcription Improvement',
        `Bear suggests:\n\n"${suggestion}"`,
        [
          { text: 'Keep original', style: 'cancel' },
          { 
            text: 'Use suggestion', 
            onPress: () => handleAIFieldUpdate('transcription', suggestion)
          }
        ]
      );
    } else {
      Alert.alert(
        'Bear AI Suggestion',
        suggestion,
        [{ text: 'Thanks!' }]
      );
    }
  };

  // Helper functions for AI actions
  const handleSuggestImprovements = () => {
    if (!transcription || transcription.trim().length === 0) {
      Alert.alert(
        'No Text to Improve',
        'Please add some transcription text first, then I can help you improve it.',
        [{ text: 'OK' }]
      );
      return;
    }

    const wordCount = transcription.trim().split(/\s+/).length;
    const hasProperPunctuation = /[.!?]/.test(transcription);
    const hasCapitalization = /[A-Z]/.test(transcription);

    let suggestions = [];
    
    if (wordCount < 10) {
      suggestions.push("Consider adding more detail about what work was performed");
    }
    
    if (!hasProperPunctuation) {
      suggestions.push("Add proper punctuation to make it more professional");
    }
    
    if (!hasCapitalization) {
      suggestions.push("Use proper capitalization");
    }

    if (suggestions.length === 0) {
      suggestions.push("Your transcription looks good! You could ask me to make it more professional if needed.");
    }

    Alert.alert(
      'Improvement Suggestions',
      suggestions.join('\n\n'),
      [{ text: 'Thanks!' }]
    );
  };

  const handleMakeProfessional = () => {
    if (!transcription || transcription.trim().length === 0) {
      Alert.alert(
        'No Text Available',
        'Please add some transcription text first.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Simple example of making text more professional
    const professional = transcription
      .toLowerCase()
      .replace(/\bum\b/g, '')
      .replace(/\buh\b/g, '')
      .replace(/\blike\b/g, '')
      .replace(/\byou know\b/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^./, (char) => char.toUpperCase())
      .replace(/\.\s*([a-z])/g, (match, char) => '. ' + char.toUpperCase());

    if (professional !== transcription) {
      Alert.alert(
        'Professional Version',
        `Bear suggests this professional version:\n\n"${professional.substring(0, 200)}${professional.length > 200 ? '...' : ''}"`,
        [
          { text: 'Keep original', style: 'cancel' },
          { 
            text: 'Use professional version', 
            onPress: () => setTranscription(professional)
          }
        ]
      );
    } else {
      Alert.alert(
        'Already Professional',
        'Your transcription already sounds professional!',
        [{ text: 'Great!' }]
      );
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
              placeholder="Your voice recording transcription..."
            />
          ) : (
            <Text style={styles.transcriptionText}>
              {transcription || 'No transcription available'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateSummary}
          disabled={!transcription || transcription.trim().length === 0}
        >
          <Text style={styles.generateButtonText}>
            Generate Summary
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ENHANCED AI Agent with Bear branding */}
      <AIAgent
        screenContext={getEnhancedScreenContext()}
        onFieldUpdate={handleAIFieldUpdate}
        onModeToggle={handleAIModeToggle}
        onAction={handleAIAction}
        onCapabilityExplain={handleCapabilityExplain}        // NEW
        onSuggestionProvided={handleSuggestionProvided}      // NEW
        position="bottom-right"
        disabled={isProcessing}
        showDebugInfo={__DEV__}                              // NEW
        customStyle={{                                       // NEW
          buttonColor: '#00b894',
          iconColor: '#ffffff',
          size: 60,
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Space for Bear AI button
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  editButton: {
    backgroundColor: '#74b9ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  transcriptionInput: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
    textAlignVertical: 'top',
    minHeight: 150,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333',
  },
  generateButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});