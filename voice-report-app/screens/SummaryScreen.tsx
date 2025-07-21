// screens/SummaryScreen.tsx - SILENT VOICE UPDATES (NO ANNOYING POPUPS)
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { generatePDF } from '../services/api';
import AIAgent from '../components/AIAgent';
import { ScreenContext, FieldInfo } from '../types/aiAgent';

type SummaryScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Summary'>;
type SummaryScreenRouteProp = RouteProp<RootStackParamList, 'Summary'>;

interface Props {
  navigation: SummaryScreenNavigationProp;
  route: SummaryScreenRouteProp;
}

export default function SummaryScreen({ navigation, route }: Props) {
  const { transcription, summary } = route.params;
  const [editableSummary, setEditableSummary] = useState(summary);
  const [editableTranscription, setEditableTranscription] = useState(transcription);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Enhanced screen context for Sam AI
  const getEnhancedScreenContext = (): ScreenContext => {
    const fields: FieldInfo[] = [
      {
        name: 'taskDescription',
        label: 'Task Description',
        currentValue: editableSummary.taskDescription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['task', 'description', 'work', 'job', 'what did you do', 'what was done', 'service'],
        placeholder: 'Describe the work performed...',
      },
      {
        name: 'location',
        label: 'Location',
        currentValue: editableSummary.location || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['location', 'place', 'where', 'site', 'address', 'client site'],
        placeholder: 'e.g., Downtown Office Building',
      },
      {
        name: 'datetime',
        label: 'Date/Time',
        currentValue: editableSummary.datetime || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['time', 'date', 'when', 'datetime', 'timestamp'],
        placeholder: 'e.g., December 15, 2024 at 2:30 PM',
      },
      {
        name: 'outcome',
        label: 'Outcome',
        currentValue: editableSummary.outcome || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['outcome', 'result', 'status', 'how did it go', 'completion status', 'success'],
        placeholder: 'How did the task go? Was it completed successfully?',
      },
      {
        name: 'notes',
        label: 'Additional Notes',
        currentValue: editableSummary.notes || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['notes', 'comments', 'additional', 'other', 'extra info', 'remarks'],
        placeholder: 'Any additional information, observations, or follow-up needed...',
      },
      {
        name: 'transcription',
        label: 'Transcription',
        currentValue: editableTranscription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['transcription', 'transcript', 'recording', 'what I said', 'original recording'],
        placeholder: 'Voice recording transcription...',
      },
    ];

    return {
      screenName: 'summary',
      visibleFields: fields,
      currentValues: {
        ...editableSummary,
        transcription: editableTranscription,
      },
      availableActions: [
        'toggle_edit_mode',
        'generate_pdf',
        'save_summary',
        'suggest_improvements',
        'clear_field',
        'add_current_time',
        'add_current_date',
      ],
      mode: isPreviewMode ? 'preview' : 'edit',
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

  const updateSummaryField = (field: keyof typeof editableSummary, value: string) => {
    setEditableSummary(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGeneratePDF = async () => {
    try {
      setIsGenerating(true);
      const pdfUrl = await generatePDF({
        summary: editableSummary,
        transcription: editableTranscription,
      });
      
      navigation.navigate('PDFPreview', {
        pdfUrl,
        summary: editableSummary,
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      Alert.alert('Error', 'Failed to generate PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  // FIXED: Silent AI field updates (no annoying popups)
  const handleAIFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🤖 Sam AI silently updating field: ${fieldName} = ${value}`);
    
    if (fieldName === 'transcription') {
      setEditableTranscription(value);
    } else if (fieldName in editableSummary) {
      updateSummaryField(fieldName as keyof typeof editableSummary, value);
    }
    
    // REMOVED: No more annoying popup notifications for voice updates
    // Voice AI should work seamlessly in the background
    // The TTS response from the AI is confirmation enough
  };

  // FIXED: Silent mode toggle (no popup)
  const handleAIModeToggle = () => {
    const newMode = !isPreviewMode;
    console.log(`🤖 Sam AI silently toggling mode to: ${newMode ? 'edit' : 'preview'}`);
    setIsPreviewMode(!isPreviewMode);
    
    // REMOVED: No popup - the AI's voice response is confirmation enough
    // Plus the user can see the mode change visually
  };

  const handleAIAction = (actionName: string, params?: any) => {
    console.log(`🤖 Sam AI executing action: ${actionName}`, params);
    
    switch (actionName) {
      case 'generate_pdf':
        handleGeneratePDF();
        break;
      case 'toggle_edit_mode':
        handleAIModeToggle();
        break;
      case 'add_current_time':
        const currentTime = new Date().toLocaleTimeString();
        updateSummaryField('datetime', `${editableSummary.datetime || ''} ${currentTime}`.trim());
        break;
      case 'add_current_date':
        const currentDate = new Date().toLocaleDateString();
        updateSummaryField('datetime', `${currentDate} ${editableSummary.datetime || ''}`.trim());
        break;
      case 'clear_field':
        if (params && params.fieldName && params.fieldName in editableSummary) {
          updateSummaryField(params.fieldName, '');
        }
        break;
      case 'suggest_improvements':
        handleSuggestImprovements();
        break;
      case 'save_summary':
        // FIXED: Silent save (no popup)
        console.log('📝 Summary saved by AI');
        break;
      default:
        // REMOVED: No generic action popup
        console.log(`🤖 Sam executed: ${actionName}`);
    }
  };

  // FIXED: Only show capability explanations when explicitly asked
  const handleCapabilityExplain = (capability: string) => {
    console.log(`🤖 Sam explaining capability: ${capability}`);
    
    const explanations = {
      field_updates: "I can help you edit and improve any field in your summary. Just say 'change the task description to...' or 'update the location'.",
      wording_help: "I can make your descriptions sound more professional. Ask me 'how does this sound?' or 'make this more professional'.",
      questions: "You can ask me what I can do, or just chat about improving your summary.",
      voice_control: "I respond to natural voice commands. Just tap me and start talking!",
      context_aware: "I understand what screen you're on and can help with relevant tasks and fields.",
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

  // FIXED: Only show suggestion popup if user needs to approve major changes
  const handleSuggestionProvided = (suggestion: string, targetField?: string) => {
    console.log(`🤖 Sam providing suggestion for ${targetField}: ${suggestion}`);
    
    const fieldLabel = targetField ? 
      getEnhancedScreenContext().visibleFields.find(f => f.name === targetField)?.label || targetField :
      'your summary';
    
    // Only show suggestion popup for major changes that need approval
    const isMinorUpdate = suggestion.length < 50 && targetField !== 'taskDescription';
    
    if (isMinorUpdate) {
      // Apply minor suggestions silently
      if (targetField && targetField in editableSummary) {
        updateSummaryField(targetField as keyof typeof editableSummary, suggestion);
      } else if (targetField === 'transcription') {
        setEditableTranscription(suggestion);
      }
      console.log(`✅ Applied minor suggestion silently: ${suggestion.substring(0, 30)}...`);
    } else {
      // Only show popup for major suggestions
      Alert.alert(
        'Suggestion from Sam AI',
        `For ${fieldLabel}: ${suggestion}`,
        [
          { text: 'Ignore', style: 'cancel' },
          { 
            text: 'Apply', 
            onPress: () => {
              if (targetField && targetField in editableSummary) {
                updateSummaryField(targetField as keyof typeof editableSummary, suggestion);
              } else if (targetField === 'transcription') {
                setEditableTranscription(suggestion);
              }
            }
          }
        ],
        { cancelable: true }
      );
    }
  };

  const handleSuggestImprovements = () => {
    // Example improvement suggestions
    const suggestions = [
      "Consider adding more specific technical details",
      "Include time estimates for the work performed", 
      "Add any follow-up actions that are needed",
      "Mention any challenges encountered and how they were resolved",
    ];
    
    const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];
    handleSuggestionProvided(randomSuggestion, 'taskDescription');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Summary</Text>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setIsPreviewMode(!isPreviewMode)}
          >
            <Text style={styles.toggleButtonText}>
              {isPreviewMode ? 'Edit' : 'Preview'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <EditableField
            label="Task Description"
            value={editableSummary.taskDescription || ''}
            onChangeText={(text) => updateSummaryField('taskDescription', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Describe the work that was performed..."
          />

          <EditableField
            label="Location"
            value={editableSummary.location || ''}
            onChangeText={(text) => updateSummaryField('location', text)}
            isEditing={!isPreviewMode}
            placeholder="Where did this work take place?"
          />

          <EditableField
            label="Date/Time"
            value={editableSummary.datetime || ''}
            onChangeText={(text) => updateSummaryField('datetime', text)}
            isEditing={!isPreviewMode}
            placeholder="When was this work performed?"
          />

          <EditableField
            label="Outcome"
            value={editableSummary.outcome || ''}
            onChangeText={(text) => updateSummaryField('outcome', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="How did the task go? Was it completed successfully?"
          />

          <EditableField
            label="Additional Notes"
            value={editableSummary.notes || ''}
            onChangeText={(text) => updateSummaryField('notes', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Any additional information or follow-up needed?"
          />
        </View>

        <View style={styles.transcriptionSection}>
          <Text style={styles.sectionTitle}>Original Transcription</Text>
          <View style={styles.transcriptionCard}>
            {!isPreviewMode ? (
              <TextInput
                style={styles.transcriptionInput}
                value={editableTranscription || ''}
                onChangeText={setEditableTranscription}
                multiline
                textAlignVertical="top"
                placeholder="Your voice recording transcription..."
              />
            ) : (
              <Text style={styles.transcriptionText}>
                {editableTranscription || 'No transcription available'}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={handleGeneratePDF}
          disabled={isGenerating}
        >
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating PDF...' : 'Generate PDF Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ENHANCED AI Agent with silent operation */}
      <AIAgent
        screenContext={getEnhancedScreenContext()}
        onFieldUpdate={handleAIFieldUpdate}
        onModeToggle={handleAIModeToggle}
        onAction={handleAIAction}
        onCapabilityExplain={handleCapabilityExplain}
        onSuggestionProvided={handleSuggestionProvided}
        position="bottom-right"
        disabled={isGenerating}
        showDebugInfo={__DEV__}
        customStyle={{
          buttonColor: '#00b894',
          iconColor: '#ffffff',
          size: 60,
        }}
      />
    </View>
  );
}

// Enhanced Editable Field Component
interface EditableFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  isEditing: boolean;
  multiline?: boolean;
  placeholder?: string;
}

const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  onChangeText,
  isEditing,
  multiline = false,
  placeholder = '',
}) => {
  const displayValue = value || placeholder;
  const isEmpty = !value;

  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}:</Text>
      {isEditing ? (
        <TextInput
          style={[
            styles.fieldInput,
            multiline && styles.fieldInputMultiline,
          ]}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholder={placeholder}
          placeholderTextColor="#999"
        />
      ) : (
        <Text style={[
          styles.fieldValue,
          isEmpty && styles.fieldValueEmpty,
        ]}>
          {displayValue}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100, // Space for AI Agent button
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
  toggleButton: {
    backgroundColor: '#74b9ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#495057',
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
    color: '#333333',
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldValue: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 22,
    padding: 4,
  },
  fieldValueEmpty: {
    color: '#999999',
    fontStyle: 'italic',
  },
  transcriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B35',
    marginBottom: 12,
  },
  transcriptionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
    minHeight: 120,
  },
  transcriptionInput: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
    textAlignVertical: 'top',
    minHeight: 100,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 20,
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