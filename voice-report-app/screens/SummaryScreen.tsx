// screens/SummaryScreen.tsx - Enhanced with Sam AI Capabilities
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
      // NEW: Enhanced fields for Sam AI
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

  // EXISTING AI Agent callback functions
  const handleAIFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🤖 Bear AI updating field: ${fieldName} = ${value}`);
    
    if (fieldName === 'transcription') {
      setEditableTranscription(value);
    } else if (fieldName in editableSummary) {
      updateSummaryField(fieldName as keyof typeof editableSummary, value);
    }
    
    // Show brief confirmation
    const fieldLabel = getEnhancedScreenContext().visibleFields.find(f => f.name === fieldName)?.label || fieldName;
    Alert.alert(
      'Field Updated',
      `${fieldLabel} has been updated by Bear AI.`,
      [{ text: 'OK' }],
      { cancelable: true }
    );
  };

  const handleAIModeToggle = () => {
    const newMode = !isPreviewMode;
    console.log(`🤖 Bear AI toggling mode to: ${newMode ? 'edit' : 'preview'}`);
    setIsPreviewMode(newMode);
    
    Alert.alert(
      'Mode Changed',
      `Bear switched to ${newMode ? 'edit' : 'preview'} mode.`,
      [{ text: 'OK' }],
      { cancelable: true }
    );
  };

  const handleAIAction = (actionName: string, params?: any) => {
    console.log(`🤖 Bear AI executing action: ${actionName}`, params);
    
    switch (actionName) {
      case 'generate_pdf':
        handleGeneratePDF();
        break;
      case 'save_summary':
        Alert.alert('Save Summary', 'Summary would be saved here.');
        break;
      case 'suggest_improvements':
        handleSuggestImprovements();
        break;
      case 'clear_field':
        if (params?.fieldName) {
          handleAIFieldUpdate(params.fieldName, '');
        }
        break;
      case 'add_current_time':
        const currentTime = new Date().toLocaleString();
        updateSummaryField('datetime', currentTime);
        break;
      case 'add_current_date':
        const currentDate = new Date().toLocaleDateString();
        updateSummaryField('datetime', currentDate);
        break;
      default:
        Alert.alert('Action', `Bear executed: ${actionName}`);
    }
  };

  // NEW: Handle capability explanations
  const handleCapabilityExplain = (capability: string) => {
    console.log(`🤖 Bear explaining capability: ${capability}`);
    
    const explanations = {
      field_updates: "I can update any field in your report by voice. Just say something like 'set location to downtown office' or 'change the task description to hardware installation'.",
      wording_help: "I can help improve your report wording. Ask me 'how does that sound?' or 'can you make this more professional?' and I'll suggest better phrasing.",
      questions: "You can ask me what I can do, check my capabilities, or just chat about your work. I'm here to help!",
      voice_control: "I work completely hands-free - perfect when you're driving or have your hands full on a job site. Just speak naturally.",
      context_aware: "I understand which screen you're on and what fields are available, so I know exactly what you're talking about when you say 'update that' or 'change the location'."
    };
    
    const explanation = explanations[capability as keyof typeof explanations] || 
      "I'm Bear, your AI assistant for creating professional service reports. I can help with field updates, suggestions, and more!";
    
    Alert.alert(
      'Bear AI Capabilities',
      explanation,
      [{ text: 'Got it, thanks!' }]
    );
  };

  // NEW: Handle suggestions from Sam
  const handleSuggestionProvided = (suggestion: string, targetField?: string) => {
    console.log(`🤖 Bear suggesting for ${targetField}: ${suggestion}`);
    
    if (targetField) {
      const fieldLabel = getEnhancedScreenContext().visibleFields.find(f => f.name === targetField)?.label || targetField;
      
      Alert.alert(
        'Suggestion from Bear',
        `For ${fieldLabel}:\n\n"${suggestion}"`,
        [
          { text: 'No thanks', style: 'cancel' },
          { 
            text: 'Use this wording', 
            onPress: () => handleAIFieldUpdate(targetField, suggestion)
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

  // Helper function for suggesting improvements
  const handleSuggestImprovements = () => {
    const emptyFields = getEnhancedScreenContext().visibleFields.filter(
      field => !field.currentValue || field.currentValue.trim().length === 0
    );
    
    if (emptyFields.length > 0) {
      const fieldNames = emptyFields.map(f => f.label).join(', ');
      Alert.alert(
        'Improvement Suggestions',
        `Consider filling in these fields for a more complete report: ${fieldNames}`,
        [{ text: 'OK' }]
      );
    } else {
      Alert.alert(
        'Great Job!',
        'Your report looks complete! All fields have been filled in.',
        [{ text: 'Thanks!' }]
      );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.logoContainer}>
            <Image 
              source={require('../assets/bears&t2.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <Text style={styles.companyName}>BearS&T</Text>
              <Text style={styles.reportType}>Work Summary</Text>
            </View>
          </View>
        </View>

        {/* Mode Toggle Button */}
        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => setIsPreviewMode(!isPreviewMode)}
        >
          <Text style={styles.modeButtonText}>
            {isPreviewMode ? '✏️ Edit Report' : '👁️ Preview Report'}
          </Text>
        </TouchableOpacity>

        {/* Summary Section */}
        <View style={styles.summarySection}>
          <Text style={styles.sectionHeading}>SUMMARY</Text>
          <View style={styles.sectionDivider} />

          <EditableField
            label="Task Description"
            value={editableSummary.taskDescription || ''}
            onChangeText={(text) => updateSummaryField('taskDescription', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Describe the work performed..."
          />

          <EditableField
            label="Location"
            value={editableSummary.location || ''}
            onChangeText={(text) => updateSummaryField('location', text)}
            isEditing={!isPreviewMode}
            placeholder="e.g., Downtown Office Building"
          />

          <EditableField
            label="Date/Time"
            value={editableSummary.datetime || ''}
            onChangeText={(text) => updateSummaryField('datetime', text)}
            isEditing={!isPreviewMode}
            placeholder="e.g., December 15, 2024 at 2:30 PM"
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
            placeholder="Any additional information, observations, or follow-up needed..."
          />
        </View>

        {/* Transcription Section */}
        <View style={styles.transcriptionSection}>
          <Text style={styles.sectionHeading}>FULL TRANSCRIPTION</Text>
          <View style={styles.sectionDivider} />

          <View style={styles.transcriptionContainer}>
            {isPreviewMode ? (
              <Text style={styles.transcriptionText}>
                {editableTranscription}
              </Text>
            ) : (
              <TextInput
                style={styles.transcriptionInput}
                value={editableTranscription}
                onChangeText={setEditableTranscription}
                multiline
                textAlignVertical="top"
                placeholder="Voice recording transcription..."
              />
            )}
          </View>
        </View>

        {/* Generate PDF Button */}
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGeneratePDF}
          disabled={isGenerating}
        >
          <Text style={styles.generateButtonText}>
            {isGenerating ? 'Generating PDF...' : 'Generate PDF Report'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ENHANCED AI Agent with all new capabilities */}
      <AIAgent
        screenContext={getEnhancedScreenContext()}
        onFieldUpdate={handleAIFieldUpdate}
        onModeToggle={handleAIModeToggle}
        onAction={handleAIAction}
        onCapabilityExplain={handleCapabilityExplain}        // NEW
        onSuggestionProvided={handleSuggestionProvided}      // NEW
        position="bottom-right"
        disabled={isGenerating}
        showDebugInfo={__DEV__}                              // NEW
        customStyle={{                                       // NEW
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
        />
      ) : (
        <Text style={[styles.fieldValue, isEmpty && styles.fieldValueEmpty]}>
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
  headerContainer: {
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  logoImage: {
    width: 50,
    height: 50,
    marginRight: 12,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  companyName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  reportType: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  modeButton: {
    backgroundColor: '#74b9ff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  modeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  summarySection: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF6B35',
    marginBottom: 8,
  },
  sectionDivider: {
    height: 2,
    backgroundColor: '#FF6B35',
    marginBottom: 16,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  fieldValue: {
    fontSize: 14,
    color: '#000000',
    paddingLeft: 10,
    paddingVertical: 4,
  },
  fieldValueEmpty: {
    color: '#999999',
    fontStyle: 'italic',
  },
  fieldInput: {
    fontSize: 14,
    color: '#000000',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#F9FAFB',
  },
  fieldInputMultiline: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  transcriptionSection: {
    marginBottom: 20,
  },
  transcriptionContainer: {
    paddingLeft: 10,
    minHeight: 100,
  },
  transcriptionText: {
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 16,
  },
  transcriptionInput: {
    fontSize: 12,
    color: '#1A1A1A',
    lineHeight: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 4,
    padding: 8,
    backgroundColor: '#F9FAFB',
  },
  generateButton: {
    backgroundColor: '#FF6B35',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 40,
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