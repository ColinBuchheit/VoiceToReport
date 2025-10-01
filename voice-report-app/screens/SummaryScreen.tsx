// voice-report-app/screens/SummaryScreen.tsx - UPDATED: Always editable fields, no Edit/Preview toggle, no title
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
import { sendCloseoutEmail } from '../services/api';
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
    work_order: summary?.work_order || '',
      
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
    
    return result;
  };

  const [editableSummary, setEditableSummary] = useState<CloseoutSummary>(
    initializeCloseoutSummary(route.params.summary)
  );
  const [editableTranscription, setEditableTranscription] = useState(route.params.transcription);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Enhanced screen context for AI - always in edit mode
  const screenContext = useSummaryScreenContext(
    editableSummary,
    false, // Always false (edit mode)
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
        transcription: editableTranscription
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

  const handleFieldUpdate = (fieldName: string, value: string) => {
    if (fieldName in editableSummary) {
      updateSummaryField(fieldName as keyof CloseoutSummary, value);
    } else if (fieldName === 'transcription') {
      setEditableTranscription(value);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContainer}>
        {/* REMOVED: Header with title and mode toggle button */}

        {/* CLOSEOUT NOTES SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>CLOSEOUT NOTES</Text>
          
          <EditableField
            label="Who did you meet with on-site?"
            value={editableSummary.onsite_contact || ''}
            onChangeText={(text) => updateSummaryField('onsite_contact', text)}
            isEditing={true} // Always editable
            placeholder="Name and role of on-site contact person..."
          />

          <EditableField
            label="Work Order #"
            value={editableSummary.work_order || ''}
            onChangeText={(text) => updateSummaryField('work_order', text)}
            isEditing={true}
            placeholder="Enter the work order number..."
          />

          <EditableField
            label="Who did you work with for support?"
            value={editableSummary.support_contact || ''}
            onChangeText={(text) => updateSummaryField('support_contact', text)}
            isEditing={true} // Always editable
            placeholder="Support team members or remote assistance..."
          />

          <EditableField
            label="What work was completed?"
            value={editableSummary.work_completed || ''}
            onChangeText={(text) => updateSummaryField('work_completed', text)}
            isEditing={true} // Always editable
            multiline
            placeholder="Describe all tasks and work that was completed..."
          />

          <EditableField
            label="Were there any delays?"
            value={editableSummary.delays || ''}
            onChangeText={(text) => updateSummaryField('delays', text)}
            isEditing={true}
            multiline
            placeholder="Any delays encountered and reasons..."
          />

          <EditableField
            label="What troubleshooting steps did you take?"
            value={editableSummary.troubleshooting_steps || ''}
            onChangeText={(text) => updateSummaryField('troubleshooting_steps', text)}
            isEditing={true}
            multiline
            placeholder="Describe troubleshooting or diagnostic steps..."
          />

          <EditableField
            label="Was the scope completed successfully?"
            value={editableSummary.scope_completed || ''}
            onChangeText={(text) => updateSummaryField('scope_completed', text)}
            isEditing={true}
            multiline
            placeholder="Yes/No and details about scope completion..."
          />

          <EditableField
            label="Who released you?"
            value={editableSummary.released_by || ''}
            onChangeText={(text) => updateSummaryField('released_by', text)}
            isEditing={true}
            placeholder="Name or title of person who released you..."
          />

          <EditableField
            label="Is there a release code? If so, what is it?"
            value={editableSummary.release_code || ''}
            onChangeText={(text) => updateSummaryField('release_code', text)}
            isEditing={true}
            placeholder="Release code or completion code..."
          />

          <EditableField
            label="Is there a return tracking number? If so, what is it?"
            value={editableSummary.return_tracking || ''}
            onChangeText={(text) => updateSummaryField('return_tracking', text)}
            isEditing={true}
            placeholder="Return tracking number for parts/equipment..."
          />
        </View>

        {/* EXPENSES SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>EXPENSES</Text>
          
          <EditableField
            label="Did you have any expenses (parking fees, etc)?"
            value={editableSummary.expenses || ''}
            onChangeText={(text) => updateSummaryField('expenses', text)}
            isEditing={true}
            multiline
            placeholder="Parking fees, tolls, meals, or other expenses..."
          />

          <EditableField
            label="What materials did you use?"
            value={editableSummary.materials_used || ''}
            onChangeText={(text) => updateSummaryField('materials_used', text)}
            isEditing={true}
            multiline
            placeholder="Parts, supplies, equipment used during service..."
          />
        </View>

        {/* OUT OF SCOPE SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>OUT OF SCOPE</Text>
          
          <EditableField
            label="Was there any out of scope work? If so, what is it and who approved the work?"
            value={editableSummary.out_of_scope_work || ''}
            onChangeText={(text) => updateSummaryField('out_of_scope_work', text)}
            isEditing={true}
            multiline
            placeholder="Any additional work performed and who approved it..."
          />
        </View>

        {/* PHOTOS SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>PHOTOS</Text>
          
          <EditableField
            label="How many photos did you upload?"
            value={editableSummary.photos_uploaded || ''}
            onChangeText={(text) => updateSummaryField('photos_uploaded', text)}
            isEditing={true}
            placeholder="Number of photos taken and uploaded..."
          />
        </View>

        {/* ADDITIONAL CONTEXT SECTION - only Additional Notes now */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>ADDITIONAL CONTEXT</Text>

          <EditableField
            label="Additional Notes"
            value={editableSummary.notes || ''}
            onChangeText={(text) => updateSummaryField('notes', text)}
            isEditing={true} // Always editable
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
              isEditing={true} // Always editable
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
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.emailButtonText}>Send Email Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* AI Agent - Floating button always visible */}
      <AIAgent
        screenContext={screenContext}
        onFieldUpdate={handleFieldUpdate}
        onAction={(action) => {
          console.log('🎯 AIAgent action triggered:', action);
          if (action === 'send_email_report' || action === 'send email report') {
            handleSendEmail();
          }
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
    backgroundColor: '#f8f9fa',
  },
  scrollContainer: {
    flex: 1,
    paddingTop: 20, // Add some top padding since we removed the header
  },
  // REMOVED: header, title, modeButton, previewModeButton, modeButtonText, previewModeText styles
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
    textAlignVertical: 'center',
  },
  transcriptionSection: {
    marginHorizontal: 20,
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
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
    marginTop: 10,
  },
  emailButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  emailButtonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  emailButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});