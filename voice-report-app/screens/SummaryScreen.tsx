// voice-report-app/screens/SummaryScreen.tsx - UPDATED with Email Success Popup
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { sendCloseoutEmail } from '../services/api';
import emailHistoryService from '../services/emailHistoryService';
import AIAgent from '../components/AIAgent';
import EmailSuccessPopup from '../components/EmailSuccessPopup';
import { useSummaryScreenContext } from '../hooks/useScreenContext';
import { CloseoutSummary } from '../types/aiAgent';
import { useFontScale } from '../context/FontScaleContext';
import userProfileService from '../services/userProfileService';

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

const EditableField: React.FC<EditableFieldProps & { scaled:(n:number)=>number }> = ({
  label,
  value,
  onChangeText,
  isEditing,
  multiline = false,
  placeholder = '',
  scaled,
}) => (
  <View style={styles.fieldContainer}>
    {!!label && <Text style={[styles.fieldLabel, { fontSize: scaled(14) }]}>{label}</Text>}
    {isEditing ? (
      <TextInput
        style={[styles.fieldInput, { fontSize: scaled(16) }, multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholder={placeholder}
      />
    ) : (
      <Text style={[styles.fieldValue, { fontSize: scaled(16) }]}>
        {value || 'Not specified'}
      </Text>
    )}
  </View>
);

export default function SummaryScreen({ navigation, route }: Props) {
  const { scaled } = useFontScale();
  // Initialize CloseoutSummary with proper field mapping
  const initializeCloseoutSummary = (summary: CloseoutSummary): CloseoutSummary => {
    console.log('🔧 Initializing CloseoutSummary from:', summary);
    
    const result: CloseoutSummary = {
      // Primary closeout fields
      onsite_contact: summary?.onsite_contact || '',
      support_contact: summary?.support_contact || '',
      work_completed: summary?.work_completed || summary?.taskDescription || '',
      delays: summary?.delays || '',
      troubleshooting_steps: summary?.troubleshooting_steps || '',
      scope_completed: summary?.scope_completed || summary?.outcome || '',
      
      
      // Sign-off and tracking
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
      location: summary?.location || '',
      technician_name: summary?.technician_name || '',
      
      // Legacy fields for backward compatibility
      taskDescription: summary?.taskDescription || summary?.work_completed || '',
      outcome: summary?.outcome || summary?.scope_completed || '',
      notes: summary?.notes || '',
    };
    
    return result;
  };

  const [editableSummary, setEditableSummary] = useState<CloseoutSummary>(
    initializeCloseoutSummary(route.params.summary)
  );
  const [editableTranscription, setEditableTranscription] = useState(route.params.transcription);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load technician profile for pre-fill
  useEffect(() => {
    (async () => {
      try {
        const profile = await userProfileService.getProfile();
        if (profile) {
          const current = editableSummary.technician_name || '';
          const lower = current.trim().toLowerCase();
          const isPlaceholder = !current.trim() || ['not mentioned', 'not specified', 'n/a', 'none'].includes(lower);
          if (isPlaceholder) {
            setEditableSummary(prev => ({ ...prev, technician_name: userProfileService.fullName(profile) }));
          }
        }        
      } catch (e) {
        console.warn('Failed to load profile for summary', e);
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, []);

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
  // Debug: log work_order and summary before sending
  console.log('📤 Sending email with work_order:', editableSummary.work_order);
  console.log('📤 Full summary payload:', editableSummary);
      
      let techEmail: string | undefined = undefined;
      try {
        const profile = await userProfileService.getProfile();
        techEmail = profile?.workEmail;
      } catch {}

      const emailResponse = await sendCloseoutEmail({
        summary: editableSummary,
        transcription: editableTranscription,
        technicianEmail: techEmail,
      });
      
      // Show success popup instead of Alert
      setEmailRecipients(emailResponse.recipients);
      setShowSuccessPopup(true);

      // Persist to local email history (non-blocking)
      (async () => {
        try {
          console.log('💾 Saving email with transcription length:', editableTranscription?.length || 0);
          console.log('💾 Transcription preview:', editableTranscription ? editableTranscription.slice(0, 100) : 'EMPTY');
          await emailHistoryService.addEmail({
            recipients: emailResponse.recipients || [],
            workOrder: editableSummary.work_order,
            technicianName: editableSummary.technician_name || editableSummary.released_by || '',
            transcription: editableTranscription,
            summary: {
              work_completed: editableSummary.work_completed,
              ...editableSummary,
            },
            rawBody: JSON.stringify({ summary: editableSummary, transcription: editableTranscription }),
          });
          console.log('🗂️ Email added to local history');
        } catch (historyErr) {
          console.warn('Failed to add email to history:', historyErr);
        }
      })();
      
    } catch (error) {
      console.error('Email sending failed:', error);
      // Keep the error as an Alert for now
      alert('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSuccessComplete = () => {
    setShowSuccessPopup(false);
    // Navigate to Home after popup closes
    navigation.navigate('Home');
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
        {/* CLOSEOUT NOTES SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18) }]}>CLOSEOUT NOTES</Text>
          
          <EditableField
            label="Who did you meet with on-site?"
            value={editableSummary.onsite_contact || ''}
            onChangeText={(text) => updateSummaryField('onsite_contact', text)}
            isEditing={true}
            placeholder="Name and role of on-site contact person..."
            scaled={scaled}
          />

          <EditableField
            label="Work Order #"
            value={editableSummary.work_order || ''}
            onChangeText={(text) => updateSummaryField('work_order', text)}
            isEditing={true}
            placeholder="Enter the work order number..."
            scaled={scaled}
          />

          <EditableField
            label="Location"
            value={editableSummary.location || ''}
            onChangeText={(text) => updateSummaryField('location', text)}
            isEditing={true}
            placeholder="Enter the location / site name..."
            scaled={scaled}
          />

          <EditableField
            label="Technician Name"
            value={editableSummary.technician_name || ''}
            onChangeText={(text) => updateSummaryField('technician_name', text)}
            isEditing={true}
            placeholder="Enter your name..."
            scaled={scaled}
          />

          <EditableField
            label="Who did you work with for support?"
            value={editableSummary.support_contact || ''}
            onChangeText={(text) => updateSummaryField('support_contact', text)}
            isEditing={true}
            placeholder="Support team members or remote assistance..."
            scaled={scaled}
          />

          <EditableField
            label="What work was completed?"
            value={editableSummary.work_completed || ''}
            onChangeText={(text) => updateSummaryField('work_completed', text)}
            isEditing={true}
            multiline
            placeholder="Describe all tasks and work that was completed..."
            scaled={scaled}
          />

          <EditableField
            label="Were there any delays?"
            value={editableSummary.delays || ''}
            onChangeText={(text) => updateSummaryField('delays', text)}
            isEditing={true}
            multiline
            placeholder="Any delays encountered and reasons..."
            scaled={scaled}
          />

          <EditableField
            label="What troubleshooting steps did you take?"
            value={editableSummary.troubleshooting_steps || ''}
            onChangeText={(text) => updateSummaryField('troubleshooting_steps', text)}
            isEditing={true}
            multiline
            placeholder="Describe debugging or problem-solving steps..."
            scaled={scaled}
          />

          <EditableField
            label="Was the scope completed successfully?"
            value={editableSummary.scope_completed || ''}
            onChangeText={(text) => updateSummaryField('scope_completed', text)}
            isEditing={true}
            multiline
            placeholder="Describe the outcome and completion status..."
            scaled={scaled}
          />
        </View>

        

        {/* SIGN-OFF & TRACKING SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18) }]}>SIGN-OFF & TRACKING</Text>
          
          <EditableField
            label="Who released you?"
            value={editableSummary.released_by || ''}
            onChangeText={(text) => updateSummaryField('released_by', text)}
            isEditing={true}
            placeholder="Name of person who signed off..."
            scaled={scaled}
          />

          <EditableField
            label="Release Code"
            value={editableSummary.release_code || ''}
            onChangeText={(text) => updateSummaryField('release_code', text)}
            isEditing={true}
            placeholder="Enter release code if applicable..."
            scaled={scaled}
          />

          <EditableField
            label="Return Tracking #"
            value={editableSummary.return_tracking || ''}
            onChangeText={(text) => updateSummaryField('return_tracking', text)}
            isEditing={true}
            placeholder="Enter return tracking number..."
            scaled={scaled}
          />
        </View>

        {/* EXPENSES & MATERIALS SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18) }]}>EXPENSES & MATERIALS</Text>
          
          <EditableField
            label="Expenses"
            value={editableSummary.expenses || ''}
            onChangeText={(text) => updateSummaryField('expenses', text)}
            isEditing={true}
            multiline
            placeholder="List any expenses incurred..."
            scaled={scaled}
          />

          <EditableField
            label="Materials Used"
            value={editableSummary.materials_used || ''}
            onChangeText={(text) => updateSummaryField('materials_used', text)}
            isEditing={true}
            multiline
            placeholder="List materials and parts used..."
            scaled={scaled}
          />
        </View>

        {/* ADDITIONAL INFORMATION SECTION */}
        <View style={styles.sectionContainer}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18) }]}>ADDITIONAL INFORMATION</Text>
          
          <EditableField
            label="Out of Scope Work"
            value={editableSummary.out_of_scope_work || ''}
            onChangeText={(text) => updateSummaryField('out_of_scope_work', text)}
            isEditing={true}
            multiline
            placeholder="Describe any work outside the original scope..."
            scaled={scaled}
          />

          <EditableField
            label="Photos Uploaded"
            value={editableSummary.photos_uploaded || ''}
            onChangeText={(text) => updateSummaryField('photos_uploaded', text)}
            isEditing={true}
            multiline
            placeholder="List photos taken and uploaded..."
            scaled={scaled}
          />
        </View>

        {/* ORIGINAL TRANSCRIPTION SECTION */}
        <View style={styles.transcriptionSection}>
          <View style={styles.transcriptionCard}>
            <Text style={[styles.sectionTitle, { fontSize: scaled(18) }]}>ORIGINAL TRANSCRIPTION</Text>
            <EditableField
              label=""
              value={editableTranscription}
              onChangeText={setEditableTranscription}
              isEditing={true}
              multiline
              placeholder="Original voice transcription..."
              scaled={scaled}
            />
          </View>
        </View>

        {/* SEND EMAIL BUTTON */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.emailButton, isSendingEmail && styles.emailButtonDisabled]}
            onPress={handleSendEmail}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={[styles.emailButtonText, { fontSize: scaled(16) }]}>Send Email Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Email Success Popup */}
      <EmailSuccessPopup
        visible={showSuccessPopup}
        emailList={emailRecipients}
        onComplete={handleSuccessComplete}
      />

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
    paddingTop: 20,
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