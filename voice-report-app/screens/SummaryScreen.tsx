// voice-report-app/screens/SummaryScreen.tsx - COMPLETE VERSION WITHOUT PDF GENERATION
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
import { sendCloseoutEmail } from '../services/api'; // REMOVED: generatePDF import
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
  // Initialize CloseoutSummary with proper field mapping
  const initializeCloseoutSummary = (summary: CloseoutSummary): CloseoutSummary => {
    console.log('🔧 Initializing CloseoutSummary from:', summary);
    console.log('🔧 Summary type:', typeof summary);
    console.log('🔧 Summary keys:', Object.keys(summary || {}));
    
    const result: CloseoutSummary = {
      // Primary closeout fields
      onsite_contact: summary?.onsite_contact || '',
      support_contact: summary?.support_contact || '',
      work_completed: summary?.work_completed || summary?.taskDescription || '',
      delays: summary?.delays || '',
      troubleshooting_steps: summary?.troubleshooting_steps || '',
      scope_completed: summary?.scope_completed || summary?.outcome || '',
      released_by: summary?.released_by || '',
      release_code: summary?.release_code || '',
      return_tracking: summary?.return_tracking || '',
      
      // Expenses and materials
      expenses: summary?.expenses || '',
      materials_used: summary?.materials_used || '',
      
      // Out of scope work
      out_of_scope_work: summary?.out_of_scope_work || '',
      
      // Photos
      photos_uploaded: summary?.photos_uploaded || '',
      
      // Additional context
      location: summary?.location || '',
      datetime: summary?.datetime || '',
      technician_name: summary?.technician_name || '',
      
      // Legacy fields for backward compatibility
      taskDescription: summary?.taskDescription || summary?.work_completed || '',
      outcome: summary?.outcome || summary?.scope_completed || '',
      notes: summary?.notes || '',
    };
    
    // DEBUGGING: Log what we extracted
    console.log('✅ Initialized CloseoutSummary:');
    console.log('  - onsite_contact:', result.onsite_contact);
    console.log('  - support_contact:', result.support_contact);
    console.log('  - work_completed:', result.work_completed);
    console.log('  - location:', result.location);
    console.log('  - technician_name:', result.technician_name);
    
    return result;
  };

  const [editableSummary, setEditableSummary] = useState<CloseoutSummary>(
    initializeCloseoutSummary(route.params.summary)
  );
  const [editableTranscription, setEditableTranscription] = useState(route.params.transcription);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  // REMOVED: isGeneratingPDF state

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
        'Email Sent Successfully!',
        `Report has been sent to ${emailResponse.recipients.join(', ')}`,
        [{ text: 'OK', onPress: () => navigation.navigate('Home') }]
      );
    } catch (error) {
      console.error('Email sending failed:', error);
      Alert.alert('Error', 'Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  // REMOVED: handleGeneratePDF function

  const handleFieldUpdate = (fieldName: string, value: string) => {
    if (fieldName in editableSummary) {
      updateSummaryField(fieldName as keyof CloseoutSummary, value);
    } else if (fieldName === 'transcription') {
      setEditableTranscription(value);
    }
  };

  const handleModeToggle = () => {
    setIsPreviewMode(!isPreviewMode);
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* Header with Mode Toggle */}
        <View style={styles.header}>
          <Text style={styles.title}>Closeout Report Summary</Text>
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
          <Text style={styles.sectionTitle}>CLOSEOUT NOTES</Text>
          
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
          <Text style={styles.sectionTitle}>EXPENSES</Text>
          
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
          <Text style={styles.sectionTitle}>OUT OF SCOPE</Text>
          
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
          <Text style={styles.sectionTitle}>PHOTOS</Text>
          
          <EditableField
            label="How many photos did you upload?"
            value={editableSummary.photos_uploaded || ''}
            onChangeText={(text) => updateSummaryField('photos_uploaded', text)}
            isEditing={!isPreviewMode}
            placeholder="Number of photos taken and uploaded..."
          />
        </View>

        {/* ADDITIONAL CONTEXT SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>ADDITIONAL CONTEXT</Text>
          
          <EditableField
            label="Location"
            value={editableSummary.location || ''}
            onChangeText={(text) => updateSummaryField('location', text)}
            isEditing={!isPreviewMode}
            placeholder="Work location, address, or site..."
          />

          <EditableField
            label="Date/Time"
            value={editableSummary.datetime || ''}
            onChangeText={(text) => updateSummaryField('datetime', text)}
            isEditing={!isPreviewMode}
            placeholder="When the work was completed..."
          />

          <EditableField
            label="Technician Name"
            value={editableSummary.technician_name || ''}
            onChangeText={(text) => updateSummaryField('technician_name', text)}
            isEditing={!isPreviewMode}
            placeholder="Your name as the technician..."
          />

          <EditableField
            label="Additional Notes"
            value={editableSummary.notes || ''}
            onChangeText={(text) => updateSummaryField('notes', text)}
            isEditing={!isPreviewMode}
            multiline
            placeholder="Any additional notes or comments..."
          />
        </View>

        {/* TRANSCRIPTION SECTION */}
        <View style={styles.transcriptionSection}>
          <View style={styles.transcriptionCard}>
            <Text style={styles.sectionTitle}>ORIGINAL TRANSCRIPTION</Text>
            <EditableField
              label="Voice Recording Transcription"
              value={editableTranscription}
              onChangeText={setEditableTranscription}
              isEditing={!isPreviewMode}
              multiline
              placeholder="Original voice recording transcription..."
            />
          </View>
        </View>

        {/* SIMPLIFIED ACTION BUTTONS - Only Email */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.emailButton, isSendingEmail && styles.emailButtonDisabled]}
            onPress={handleSendEmail}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? (
              <View style={styles.sendingContainer}>
                <ActivityIndicator size="small" color="white" />
                <Text style={styles.emailButtonText}>Sending Email...</Text>
              </View>
            ) : (
              <Text style={styles.emailButtonText}>Send Email Report</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeButton}
            onPress={() => navigation.navigate('Home')}
          >
            <Text style={styles.homeButtonText}>Create New Report</Text>
          </TouchableOpacity>
        </View>

        {/* Email Recipients Info */}
        <View style={styles.recipientsInfo}>
          <Text style={styles.recipientsTitle}>Email will be sent to:</Text>
          <Text style={styles.recipientsText}>colbol42@gmail.com</Text>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* AI Agent for voice commands */}
      <AIAgent
        screenContext={screenContext}
        onFieldUpdate={handleFieldUpdate}
        onModeToggle={handleModeToggle}
        onAction={(action) => {
          if (action === 'send_email_report') {
            handleSendEmail();
          }
          // REMOVED: PDF generation action
        }}
        position="bottom-right"
        showDebugInfo={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    backgroundColor: 'white',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  modeButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
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
    marginHorizontal: 20,
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
    marginHorizontal: 20,
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
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 15,
    marginBottom: 20,
  },
  emailButton: {
    flex: 2,
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  emailButtonDisabled: {
    opacity: 0.7,
  },
  emailButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  homeButton: {
    flex: 1,
    backgroundColor: '#6B7280',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  homeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  sendingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recipientsInfo: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  recipientsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 8,
  },
  recipientsText: {
    fontSize: 14,
    color: '#1E40AF',
  },
  bottomSpacing: {
    height: 100,
  },
});