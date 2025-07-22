// screens/SummaryScreen.tsx - UPDATED FOR CLOSEOUT REPORTS
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { sendCloseoutEmail, generatePDF } from '../services/api';
import AIAgent from '../components/AIAgent';
import { useSummaryScreenContext } from '../hooks/useScreenContext';
import { CloseoutSummary } from '../types/aiAgent';

type SummaryScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Summary'
>;
type SummaryScreenRouteProp = RouteProp<RootStackParamList, 'Summary'>;

interface Props {
  navigation: SummaryScreenNavigationProp;
  route: SummaryScreenRouteProp;
}

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
}) => (
  <View style={styles.fieldContainer}>
    <Text style={styles.fieldLabel}>{label}</Text>
    {isEditing ? (
      <TextInput
        style={[styles.fieldInput, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
      />
    ) : (
      <Text style={styles.fieldValue}>
        {value || 'Not specified'}
      </Text>
    )}
  </View>
);

export default function SummaryScreen({ navigation, route }: Props) {
  // Convert legacy summary to closeout summary format with defaults
  const initializeCloseoutSummary = (summary: any): CloseoutSummary => ({
    // Map legacy fields to new structure
    work_completed: summary.taskDescription || '',
    scope_completed: summary.outcome || '',
    notes: summary.notes || '',
    location: summary.location || '',
    datetime: summary.datetime || '',
    
    // Initialize new closeout fields
    onsite_contact: summary.onsite_contact || '',
    support_contact: summary.support_contact || '',
    delays: summary.delays || '',
    troubleshooting_steps: summary.troubleshooting_steps || '',
    released_by: summary.released_by || '',
    release_code: summary.release_code || '',
    return_tracking: summary.return_tracking || '',
    expenses: summary.expenses || '',
    materials_used: summary.materials_used || '',
    out_of_scope_work: summary.out_of_scope_work || '',
    photos_uploaded: summary.photos_uploaded || '',
    technician_name: summary.technician_name || '',
    
    // Keep legacy fields for backward compatibility
    taskDescription: summary.taskDescription || '',
    outcome: summary.outcome || '',
  });

  const [editableSummary, setEditableSummary] = useState<CloseoutSummary>(
    initializeCloseoutSummary(route.params.summary)
  );
  const [editableTranscription, setEditableTranscription] = useState(route.params.transcription);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Enhanced screen context for AI
  const screenContext = useSummaryScreenContext(
    editableSummary,
    isPreviewMode,
    editableTranscription
  );

  const updateSummaryField = (field: keyof CloseoutSummary, value: string) => {
    setEditableSummary(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendEmail = async () => {
    try {
      setIsSendingEmail(true);
      
      const emailResponse = await sendCloseoutEmail({
        summary: editableSummary,
        transcription: editableTranscription,
        technician_name: editableSummary.technician_name
      });
      
      Alert.alert(
        'Email Sent Successfully! 📧',
        `Closeout report has been sent to:\n\n${emailResponse.recipients.join('\n')}\n\nMessage: ${emailResponse.message}`,
        [
          {
            text: 'Create New Report',
            onPress: () => navigation.navigate('Home'),
          },
          {
            text: 'Close',
            style: 'cancel',
          },
        ]
      );
    } catch (error) {
      console.error('Error sending email:', error);
      Alert.alert(
        'Email Failed',
        error instanceof Error ? error.message : 'Failed to send email. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Keep PDF generation for backward compatibility
  const handleGeneratePDF = async () => {
    try {
      setIsGeneratingPDF(true);
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
      setIsGeneratingPDF(false);
    }
  };

  // AI field updates
  const handleAIFieldUpdate = (fieldName: string, value: string) => {
    console.log(`🤖 AI updating field: ${fieldName} = ${value}`);
    
    if (fieldName === 'transcription') {
      setEditableTranscription(value);
    } else if (fieldName in editableSummary) {
      updateSummaryField(fieldName as keyof CloseoutSummary, value);
    }
  };

  // AI mode toggle
  const handleAIModeToggle = () => {
    const newMode = !isPreviewMode;
    console.log(`🤖 AI toggling mode to: ${newMode ? 'preview' : 'edit'}`);
    setIsPreviewMode(newMode);
  };

  // AI custom actions
  const handleAICustomAction = (action: string) => {
    console.log(`🤖 AI custom action: ${action}`);
    if (action === 'send_email') {
      handleSendEmail();
    } else if (action === 'generate_pdf') {
      handleGeneratePDF();
    } else if (action === 'add_current_time') {
      const now = new Date().toLocaleString();
      updateSummaryField('datetime', now);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Field Service Closeout Report</Text>
          <TouchableOpacity
            style={[styles.modeButton, isPreviewMode && styles.previewModeButton]}
            onPress={() => setIsPreviewMode(!isPreviewMode)}
          >
            <Text style={[styles.modeButtonText, isPreviewMode && styles.previewModeText]}>
              {isPreviewMode ? 'Preview' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* CLOSEOUT NOTES SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>📋 CLOSEOUT NOTES</Text>
          
          <EditableField
            label="Who did you meet with on-site?"
            value={editableSummary.onsite_contact || ''}
            onChangeText={(text) => updateSummaryField('onsite_contact', text)}
            isEditing={!isPreviewMode}
            placeholder="Name and role of on-site contact person..."
          />

          <EditableField
            label="Who did you work with for support?"
            value={editableSummary.support_contact || ''}
            onChangeText={(text) => updateSummaryField('support_contact', text)}
            isEditing={!isPreviewMode}
            placeholder="Support team members or remote assistance..."
          />

          <EditableField
            label="What work was completed?"
            value={editableSummary.work_completed || ''}
            onChangeText={(text) => updateSummaryField('work_completed', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Describe all tasks and work that was completed..."
          />

          <EditableField
            label="Were there any delays?"
            value={editableSummary.delays || ''}
            onChangeText={(text) => updateSummaryField('delays', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Any delays encountered and reasons..."
          />

          <EditableField
            label="What troubleshooting steps did you take?"
            value={editableSummary.troubleshooting_steps || ''}
            onChangeText={(text) => updateSummaryField('troubleshooting_steps', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Describe troubleshooting steps and problem-solving approaches..."
          />

          <EditableField
            label="Was the scope completed successfully?"
            value={editableSummary.scope_completed || ''}
            onChangeText={(text) => updateSummaryField('scope_completed', text)}
            isEditing={!isPreviewMode}
            placeholder="Yes/No and any additional details..."
          />

          <EditableField
            label="Who released you?"
            value={editableSummary.released_by || ''}
            onChangeText={(text) => updateSummaryField('released_by', text)}
            isEditing={!isPreviewMode}
            placeholder="Name and role of person who released you..."
          />

          <EditableField
            label="Release code (if any)"
            value={editableSummary.release_code || ''}
            onChangeText={(text) => updateSummaryField('release_code', text)}
            isEditing={!isPreviewMode}
            placeholder="Authorization or release code..."
          />

          <EditableField
            label="Return tracking number (if any)"
            value={editableSummary.return_tracking || ''}
            onChangeText={(text) => updateSummaryField('return_tracking', text)}
            isEditing={!isPreviewMode}
            placeholder="Tracking number for returned items..."
          />
        </View>

        {/* EXPENSES SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>💰 EXPENSES</Text>
          
          <EditableField
            label="Any expenses (parking fees, etc)?"
            value={editableSummary.expenses || ''}
            onChangeText={(text) => updateSummaryField('expenses', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Parking fees, tolls, meals, or other expenses..."
          />

          <EditableField
            label="What materials did you use?"
            value={editableSummary.materials_used || ''}
            onChangeText={(text) => updateSummaryField('materials_used', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Parts, supplies, equipment used during service..."
          />
        </View>

        {/* OUT OF SCOPE SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>⚠️ OUT OF SCOPE</Text>
          
          <EditableField
            label="Out of scope work and who approved it"
            value={editableSummary.out_of_scope_work || ''}
            onChangeText={(text) => updateSummaryField('out_of_scope_work', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Any additional work performed and approval details..."
          />
        </View>

        {/* PHOTOS SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>📸 PHOTOS</Text>
          
          <EditableField
            label="How many photos did you upload?"
            value={editableSummary.photos_uploaded || ''}
            onChangeText={(text) => updateSummaryField('photos_uploaded', text)}
            isEditing={!isPreviewMode}
            placeholder="Number of photos and brief description..."
          />
        </View>

        {/* ADDITIONAL INFO SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>ℹ️ ADDITIONAL INFO</Text>
          
          <EditableField
            label="Location"
            value={editableSummary.location || ''}
            onChangeText={(text) => updateSummaryField('location', text)}
            isEditing={!isPreviewMode}
            placeholder="Service location address or description..."
          />

          <EditableField
            label="Date/Time"
            value={editableSummary.datetime || ''}
            onChangeText={(text) => updateSummaryField('datetime', text)}
            isEditing={!isPreviewMode}
            placeholder="Date and time of service..."
          />

          <EditableField
            label="Technician Name"
            value={editableSummary.technician_name || ''}
            onChangeText={(text) => updateSummaryField('technician_name', text)}
            isEditing={!isPreviewMode}
            placeholder="Your name..."
          />

          <EditableField
            label="Additional Notes"
            value={editableSummary.notes || ''}
            onChangeText={(text) => updateSummaryField('notes', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Any additional information or follow-up needed..."
          />
        </View>

        {/* ORIGINAL TRANSCRIPTION SECTION */}
        <View style={styles.transcriptionSection}>
          <Text style={styles.sectionTitle}>🎙️ ORIGINAL TRANSCRIPTION</Text>
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

        {/* ACTION BUTTONS */}
        <View style={styles.actionButtonsContainer}>
          {/* PRIMARY: Send Email Button */}
          <TouchableOpacity
            style={[styles.sendButton, isSendingEmail && styles.sendButtonDisabled]}
            onPress={handleSendEmail}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? (
              <View style={styles.sendingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.sendButtonText}>Sending Email...</Text>
              </View>
            ) : (
              <Text style={styles.sendButtonText}>📧 Send Closeout Email</Text>
            )}
          </TouchableOpacity>

          {/* SECONDARY: Generate PDF Button (for backward compatibility) */}
          <TouchableOpacity
            style={[styles.pdfButton, isGeneratingPDF && styles.pdfButtonDisabled]}
            onPress={handleGeneratePDF}
            disabled={isGeneratingPDF}
          >
            {isGeneratingPDF ? (
              <View style={styles.sendingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.pdfButtonText}>Generating PDF...</Text>
              </View>
            ) : (
              <Text style={styles.pdfButtonText}>📄 Generate PDF (Legacy)</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.recipientsInfo}>
          <Text style={styles.recipientsTitle}>Email Recipients:</Text>
          <Text style={styles.recipientsText}>
            • russell.dummerth@beartechs.com{'\n'}
            • austin.davenport@beartechs.com{'\n'}
            • todd.davenport@beartechs.com
          </Text>
        </View>
      </ScrollView>

      {/* AI VOICE ASSISTANT */}
      <AIAgent
        screenContext={screenContext}
        onFieldUpdate={handleAIFieldUpdate}
        onModeToggle={handleAIModeToggle}
        onCustomAction={handleAICustomAction}
      />
    </View>
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
  modeButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  previewModeButton: {
    backgroundColor: '#27ae60',
  },
  modeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  previewModeText: {
    color: 'white',
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 8,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    minHeight: 44,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldValue: {
    fontSize: 16,
    color: '#2c3e50',
    padding: 12,
    backgroundColor: '#ecf0f1',
    borderRadius: 8,
    minHeight: 44,
  },
  transcriptionSection: {
    marginBottom: 20,
  },
  transcriptionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
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
    fontSize: 14,
    color: '#2c3e50',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
  },
  transcriptionText: {
    fontSize: 14,
    color: '#2c3e50',
    lineHeight: 20,
    minHeight: 120,
  },
  actionButtonsContainer: {
    marginBottom: 16,
  },
  sendButton: {
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
  sendButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pdfButton: {
    backgroundColor: '#95a5a6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  pdfButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  pdfButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  sendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientsInfo: {
    backgroundColor: '#e8f4fd',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  recipientsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  recipientsText: {
    fontSize: 12,
    color: '#34495e',
    lineHeight: 18,
  },
});