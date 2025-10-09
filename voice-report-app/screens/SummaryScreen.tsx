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
import { useTheme } from '../context/ThemeContext';

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
  highlight?: boolean;
  highlightBadge?: string;
}

const EditableField: React.FC<EditableFieldProps & { scaled:(n:number)=>number }> = ({
  label,
  value,
  onChangeText,
  isEditing,
  multiline = false,
  placeholder = '',
  scaled,
  highlight = false,
  highlightBadge = 'AI updated'
}) => {
  const { colors, isDark } = useTheme();
  const accent = colors.accent || '#FF6B35';
  const fieldBorderColor = highlight ? accent : colors.border;
  const fieldBg = isEditing
    ? (isDark ? colors.surfaceAlt : '#fff')
    : (isDark ? colors.surfaceAlt : '#ecf0f1');
  const highlightGlow = highlight ? {
    shadowColor: accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  } : {};

  return (
    <View style={[styles.fieldContainer, highlight && styles.fieldContainerHighlighted]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: label ? 8 : 0 }}>
        {!!label && <Text style={[styles.fieldLabel, { fontSize: scaled(14), color: colors.textSecondary }]}>{label}</Text>}
        {highlight && (
          <View style={[styles.highlightPill, { backgroundColor: accent + '22', borderColor: accent }]}> 
            <Text style={[styles.highlightPillText, { color: accent, fontSize: scaled(10) }]}>{highlightBadge}</Text>
          </View>
        )}
      </View>
      {isEditing ? (
        <TextInput
          style={[styles.fieldInput, {
            fontSize: scaled(16),
            backgroundColor: fieldBg,
            borderColor: fieldBorderColor,
            color: colors.textPrimary,
          }, multiline && styles.multilineInput, highlightGlow]}
          value={value}
          onChangeText={onChangeText}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
        />
      ) : (
        <Text style={[styles.fieldValue, {
          fontSize: scaled(16),
            color: colors.textPrimary,
            backgroundColor: fieldBg,
            borderColor: fieldBorderColor,
          }, highlightGlow]}
        >
          {value || 'Not specified'}
        </Text>
      )}
    </View>
  );
};

export default function SummaryScreen({ navigation, route }: Props) {
  const { scaled } = useFontScale();
  const { colors } = useTheme();
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

  // One-time initializer prevents remount or hot-refresh from reusing stale route params
  const [editableSummary, setEditableSummary] = useState<CloseoutSummary>(() =>
    initializeCloseoutSummary(route.params.summary)
  );
  const [editableTranscription, setEditableTranscription] = useState(route.params.transcription);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  // Track recent AI updates (field -> timestamp)
  const [aiFieldUpdates, setAiFieldUpdates] = useState<Record<string, number>>({});
  const [fieldHistory, setFieldHistory] = useState<Record<string, { previous?: string; current: string }>>({});
  const [fieldHistoryMeta, setFieldHistoryMeta] = useState<Record<string, number>>({});

  // Highlight window (ms)
  const HIGHLIGHT_WINDOW_MS = 8000;
  const shouldHighlight = (field: string) => {
    const ts = aiFieldUpdates[field];
    return !!ts && (Date.now() - ts) < HIGHLIGHT_WINDOW_MS;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setAiFieldUpdates(prev => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
            if (now - v < HIGHLIGHT_WINDOW_MS) next[k] = v; else changed = true;
        }
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

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
    false,
    editableTranscription,
    fieldHistory,
    fieldHistoryMeta
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
    setAiFieldUpdates(prev => ({ ...prev, [fieldName]: Date.now() }));
    const now = Date.now();
    if (fieldName === 'transcription') {
      setFieldHistory(prev => ({
        ...prev,
        transcription: {
          // If first time editing, previous should be the current editableTranscription before change
          previous: prev.transcription ? (
            prev.transcription.current !== value ? prev.transcription.current : prev.transcription.previous
          ) : editableTranscription,
          current: value
        }
      }));
      setFieldHistoryMeta(prev => ({ ...prev, transcription: now }));
      setEditableTranscription(value);
      return;
    }
    if (fieldName in editableSummary) {
      const currentVal = (editableSummary as any)[fieldName] || '';
      if (currentVal !== value) {
        setFieldHistory(prev => ({
          ...prev,
          [fieldName]: {
            // If no history yet, capture the current value as the previous baseline
            previous: prev[fieldName] ? (
              prev[fieldName].current !== value ? prev[fieldName].current : prev[fieldName].previous
            ) : currentVal,
            current: value
          }
        }));
        setFieldHistoryMeta(prev => ({ ...prev, [fieldName]: now }));
      }
      updateSummaryField(fieldName as keyof CloseoutSummary, value);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={{ paddingBottom: 180 }}>
        {/* CLOSEOUT NOTES SECTION */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18), color: colors.textPrimary, borderBottomColor: colors.border }]} accessibilityRole="header">CLOSEOUT NOTES</Text>
          
          <EditableField
            label="Who did you meet with on-site?"
            value={editableSummary.onsite_contact || ''}
            onChangeText={(text) => updateSummaryField('onsite_contact', text)}
            isEditing={true}
            placeholder="Name and role of on-site contact person..."
            scaled={scaled}
            highlight={shouldHighlight('onsite_contact')}
          />

          <EditableField
            label="Work Order #"
            value={editableSummary.work_order || ''}
            onChangeText={(text) => updateSummaryField('work_order', text)}
            isEditing={true}
            placeholder="Enter the work order number..."
            scaled={scaled}
            highlight={shouldHighlight('work_order')}
          />

          <EditableField
            label="Location"
            value={editableSummary.location || ''}
            onChangeText={(text) => updateSummaryField('location', text)}
            isEditing={true}
            placeholder="Enter the location / site name..."
            scaled={scaled}
            highlight={shouldHighlight('location')}
          />

          <EditableField
            label="Technician Name"
            value={editableSummary.technician_name || ''}
            onChangeText={(text) => updateSummaryField('technician_name', text)}
            isEditing={true}
            placeholder="Enter your name..."
            scaled={scaled}
            highlight={shouldHighlight('technician_name')}
          />

          <EditableField
            label="Who did you work with for support?"
            value={editableSummary.support_contact || ''}
            onChangeText={(text) => updateSummaryField('support_contact', text)}
            isEditing={true}
            placeholder="Support team members or remote assistance..."
            scaled={scaled}
            highlight={shouldHighlight('support_contact')}
          />

          <EditableField
            label="What work was completed?"
            value={editableSummary.work_completed || ''}
            onChangeText={(text) => updateSummaryField('work_completed', text)}
            isEditing={true}
            multiline
            placeholder="Describe all tasks and work that was completed..."
            scaled={scaled}
            highlight={shouldHighlight('work_completed')}
          />

          <EditableField
            label="Were there any delays?"
            value={editableSummary.delays || ''}
            onChangeText={(text) => updateSummaryField('delays', text)}
            isEditing={true}
            multiline
            placeholder="Any delays encountered and reasons..."
            scaled={scaled}
            highlight={shouldHighlight('delays')}
          />

          <EditableField
            label="What troubleshooting steps did you take?"
            value={editableSummary.troubleshooting_steps || ''}
            onChangeText={(text) => updateSummaryField('troubleshooting_steps', text)}
            isEditing={true}
            multiline
            placeholder="Describe debugging or problem-solving steps..."
            scaled={scaled}
            highlight={shouldHighlight('troubleshooting_steps')}
          />

          <EditableField
            label="Was the scope completed successfully?"
            value={editableSummary.scope_completed || ''}
            onChangeText={(text) => updateSummaryField('scope_completed', text)}
            isEditing={true}
            multiline
            placeholder="Describe the outcome and completion status..."
            scaled={scaled}
            highlight={shouldHighlight('scope_completed')}
          />
        </View>

        

        {/* SIGN-OFF & TRACKING SECTION */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18), color: colors.textPrimary, borderBottomColor: colors.border }]}>SIGN-OFF & TRACKING</Text>
          
          <EditableField
            label="Who released you?"
            value={editableSummary.released_by || ''}
            onChangeText={(text) => updateSummaryField('released_by', text)}
            isEditing={true}
            placeholder="Name of person who signed off..."
            scaled={scaled}
            highlight={shouldHighlight('released_by')}
          />

          <EditableField
            label="Release Code"
            value={editableSummary.release_code || ''}
            onChangeText={(text) => updateSummaryField('release_code', text)}
            isEditing={true}
            placeholder="Enter release code if applicable..."
            scaled={scaled}
            highlight={shouldHighlight('release_code')}
          />

          <EditableField
            label="Return Tracking #"
            value={editableSummary.return_tracking || ''}
            onChangeText={(text) => updateSummaryField('return_tracking', text)}
            isEditing={true}
            placeholder="Enter return tracking number..."
            scaled={scaled}
            highlight={shouldHighlight('return_tracking')}
          />
        </View>

        {/* EXPENSES & MATERIALS SECTION */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18), color: colors.textPrimary, borderBottomColor: colors.border }]}>EXPENSES & MATERIALS</Text>
          
          <EditableField
            label="Expenses"
            value={editableSummary.expenses || ''}
            onChangeText={(text) => updateSummaryField('expenses', text)}
            isEditing={true}
            multiline
            placeholder="List any expenses incurred..."
            scaled={scaled}
            highlight={shouldHighlight('expenses')}
          />

          <EditableField
            label="Materials Used"
            value={editableSummary.materials_used || ''}
            onChangeText={(text) => updateSummaryField('materials_used', text)}
            isEditing={true}
            multiline
            placeholder="List materials and parts used..."
            scaled={scaled}
            highlight={shouldHighlight('materials_used')}
          />
        </View>

        {/* ADDITIONAL INFORMATION SECTION */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { fontSize: scaled(18), color: colors.textPrimary, borderBottomColor: colors.border }]}>ADDITIONAL INFORMATION</Text>
          
          <EditableField
            label="Out of Scope Work"
            value={editableSummary.out_of_scope_work || ''}
            onChangeText={(text) => updateSummaryField('out_of_scope_work', text)}
            isEditing={true}
            multiline
            placeholder="Describe any work outside the original scope..."
            scaled={scaled}
            highlight={shouldHighlight('out_of_scope_work')}
          />

          <EditableField
            label="Photos Uploaded"
            value={editableSummary.photos_uploaded || ''}
            onChangeText={(text) => updateSummaryField('photos_uploaded', text)}
            isEditing={true}
            multiline
            placeholder="List photos taken and uploaded..."
            scaled={scaled}
            highlight={shouldHighlight('photos_uploaded')}
          />
        </View>

        {/* ORIGINAL TRANSCRIPTION SECTION */}
        <View style={styles.transcriptionSection}>
          <View style={[styles.transcriptionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { fontSize: scaled(18), color: colors.textPrimary, borderBottomColor: colors.border }]}>ORIGINAL TRANSCRIPTION</Text>
            <EditableField
              label=""
              value={editableTranscription}
              onChangeText={setEditableTranscription}
              isEditing={true}
              multiline
              placeholder="Original voice transcription..."
              scaled={scaled}
              highlight={shouldHighlight('transcription')}
              highlightBadge="AI revised"
            />
          </View>
        </View>

        {/* SEND EMAIL BUTTON */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.emailButton, { backgroundColor: colors.accent }, isSendingEmail && styles.emailButtonDisabled]}
            onPress={handleSendEmail}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={[styles.emailButtonText, { fontSize: scaled(16), color: colors.accentContrast }]}>Send Email Report</Text>
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
        position="bottom-center"
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
    borderWidth: 1,
    borderColor: '#ecf0f1'
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
    borderWidth: 1,
    borderColor: '#ecf0f1'
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
  fieldContainerHighlighted: {
    // container highlight wrapper if needed in future
  },
  highlightPill: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  highlightPillText: {
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
});