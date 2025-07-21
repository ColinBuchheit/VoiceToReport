// screens/TranscriptScreen.tsx - SILENT VOICE UPDATES (NO ANNOYING POPUPS)
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

  // FIXED: Silent AI field updates (no annoying popups)
  const handleAIFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🤖 Bear AI silently updating field: ${fieldName} = ${value}`);
    
    if (fieldName === 'transcription') {
      setTranscription(value);
      // REMOVED: No more annoying popup notifications for voice updates
      // The AI's voice response is confirmation enough
    }
  };

  // FIXED: Silent mode toggle (no popup)
  const handleAIModeToggle = () => {
    const newMode = !isEditing;
    console.log(`🤖 Bear AI silently toggling edit mode to: ${newMode}`);
    setIsEditing(newMode);
    
    // REMOVED: No popup - the AI's voice response is confirmation enough
    // Plus the user can see the mode change visually
  };

  const handleAIAction = (actionName: string, params?: any) => {
    console.log(`🤖 Bear AI executing action: ${actionName}`, params);
    
    switch (actionName) {
      case 'generate_summary':
        handleGenerateSummary();
        break;
      case 'clear_transcription':
        // Only show confirmation for destructive actions
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
      case 'toggle_edit_mode':
        handleAIModeToggle();
        break;
      default:
        // REMOVED: No generic action popup
        console.log(`🤖 Bear executed: ${actionName}`);
    }
  };

  // FIXED: Only show capability explanations when explicitly asked
  const handleCapabilityExplain = (capability: string) => {
    console.log(`🤖 Bear explaining capability: ${capability}`);
    
    const explanations = {
      field_updates: "I can help you edit and improve your transcription text. Just say 'change the transcription to...' or 'update the text'.",
      wording_help: "I can make your transcription sound more professional. Ask me 'how does this sound?' or 'make this more professional'.",
      questions: "You can ask me what I can do, or just chat about improving your transcription.",
      voice_control: "I respond to natural voice commands. Just tap me and start talking!",
      context_aware: "I understand you're working with transcription text and can help make it better.",
    };
    
    const explanation = explanations[capability as keyof typeof explanations] || 
      `I can help with ${capability}. Just tap me and ask!`;
    
    // Only show popup for explicit capability requests
    Alert.alert(
      `${capability.replace('_', ' ').toUpperCase()} Capability`,
      explanation,
      [{ text: 'Got it!' }],
      { cancelable: true }
    );
  };

  // FIXED: Smart suggestion handling - only popup for major changes
  const handleSuggestionProvided = (suggestion: string, targetField?: string) => {
    console.log(`🤖 Bear providing suggestion for ${targetField}: ${suggestion}`);
    
    // Check if this is a minor improvement (small text changes) or major rewrite
    const currentText = transcription || '';
    const similarityRatio = calculateSimilarity(currentText, suggestion);
    const isMinorChange = similarityRatio > 0.7 || suggestion.length < 100;
    
    if (isMinorChange && targetField === 'transcription') {
      // Apply minor improvements silently
      setTranscription(suggestion);
      console.log(`✅ Applied minor transcription improvement silently`);
    } else {
      // Only show popup for major changes
      Alert.alert(
        'Suggestion from Bear AI',
        `For your transcription: ${suggestion}`,
        [
          { text: 'Ignore', style: 'cancel' },
          { 
            text: 'Apply', 
            onPress: () => {
              if (targetField === 'transcription') {
                setTranscription(suggestion);
              }
            }
          }
        ],
        { cancelable: true }
      );
    }
  };

  // Helper function to calculate text similarity
  const calculateSimilarity = (text1: string, text2: string): number => {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  const handleSuggestImprovements = () => {
    // Example improvement suggestions
    const suggestions = [
      "Consider adding more specific details about the timeline",
      "Include technical specifications that were mentioned",
      "Add any follow-up actions that were discussed",
      "Mention any challenges encountered during the work",
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    handleSuggestionProvided(randomSuggestion, 'transcription');
  };

  const handleMakeProfessional = () => {
    // Simulate making the transcription more professional
    const professionalVersion = transcription
      .replace(/\b(um|uh|like|you know)\b/gi, '') // Remove filler words
      .replace(/\s+/g, ' ') // Clean up extra spaces
      .trim()
      .replace(/\bi\b/g, 'I') // Capitalize "I"
      .replace(/^./, transcription.charAt(0).toUpperCase()); // Capitalize first letter
      
    if (professionalVersion !== transcription && professionalVersion.length > 0) {
      // This is usually a minor improvement, apply silently
      handleSuggestionProvided(professionalVersion, 'transcription');
    } else {
      // Only show this if no improvement was possible
      console.log('📝 Transcription is already professional');
    }
  };

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
              placeholderTextColor="#999"
            />
          ) : (
            <Text style={styles.transcriptionText}>
              {transcription || 'No transcription available'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.generateButton,
            (!transcription || transcription.trim().length === 0 || isProcessing) && styles.generateButtonDisabled
          ]}
          onPress={handleGenerateSummary}
          disabled={!transcription || transcription.trim().length === 0 || isProcessing}
        >
          <Text style={styles.generateButtonText}>
            {isProcessing ? 'Generating Summary...' : 'Generate Summary'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Show loading overlay when processing */}
      {isProcessing && <Loader />}

      {/* ENHANCED AI Agent with silent operation */}
      <AIAgent
        screenContext={getEnhancedScreenContext()}
        onFieldUpdate={handleAIFieldUpdate}
        onModeToggle={handleAIModeToggle}
        onAction={handleAIAction}
        onCapabilityExplain={handleCapabilityExplain}
        onSuggestionProvided={handleSuggestionProvided}
        position="bottom-right"
        disabled={isProcessing}
        showDebugInfo={__DEV__}
        customStyle={{
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
  generateButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});