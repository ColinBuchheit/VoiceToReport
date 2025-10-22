// voice-report-app/screens/SummaryScreen.tsx - UPDATED with Email Success Popup
import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { sendCloseoutEmail, generateSummary } from '../services/api';
import emailHistoryService from '../services/emailHistoryService';
import draftService from '../services/draftService';
import AIAgent from '../components/AIAgent';
import DraftSaveButton from '../components/DraftSaveButton';
import useAutoSave from '../hooks/useAutoSave';
import EmailSuccessPopup from '../components/EmailSuccessPopup';
import DraftSavedPopup from '../components/DraftSavedPopup';
import { Ionicons } from '@expo/vector-icons';
import { CloseoutSummary, ScreenContext } from '../types/aiAgent';
import { useFontScale } from '../context/FontScaleContext';
import userProfileService from '../services/userProfileService';
import { useTheme } from '../context/ThemeContext';
import { AIAgentService } from '../services/aiAgentService';
import audioLockService from '../services/audioLockService';
import { useSummary } from '../context/SummaryContext';
import { useChecklist } from '../context/ChecklistContext';
import { useReportSession } from '../context/ReportSessionContext';
import { useTranscription } from '../context/TranscriptionContext';

// Allowed scope status options (used by UI and validation)
const SCOPE_STATUS_OPTIONS = [
  'Complete',
  'Incomplete',
  'Incomplete – Revisit required',
  'Multi-day scope',
];

// Normalize free-text/AI strings to one of the allowed scope statuses
const normalizeScopeStatus = (raw?: string): string => {
  if (!raw) return '';
  const r = raw.trim().toLowerCase();
  // Straight matches first
  if (r === 'complete' || r === 'completed' || r === 'done' || r === 'finished' || r === 'success' || r === 'yes' || r === 'fully complete' || r === 'fully completed') {
    return 'Complete';
  }
  if (r === 'incomplete' || r === 'not complete' || r === 'not completed' || r === 'no' || r === 'did not complete' || r === 'unfinished') {
    return 'Incomplete';
  }
  // Partial variants and phrases implying a follow-up/revisit
  if (
    r.includes('partial') ||
    r.includes('partially') ||
    r.includes('revisit') ||
    r.includes('follow up') || r.includes('follow-up') ||
    r.includes('come back') || r.includes('return visit') ||
    r.includes('not fully') || r.includes('in progress')
  ) {
    return 'Incomplete – Revisit required';
  }
  // Multi-day variants
  if (r.includes('multi day') || r.includes('multi-day') || r.includes('multi‑day') || r.includes('multi day scope') || r.includes('multi-day scope') || r.includes('continuing') || r.includes('return tomorrow') || r.includes('next day')) {
    return 'Multi-day scope';
  }
  // Unknown => leave blank so UI requires explicit choice
  return '';
};

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
  // Cleanup mic/audio when leaving this screen
  useFocusEffect(
    React.useCallback(() => {
      console.log('🟢 SummaryScreen focused');
      return () => {
        console.log('🧹 SummaryScreen blur cleanup queued');
        Promise.resolve().then(async () => {
          try {
            const aiService = AIAgentService.getInstance();
            await aiService.cleanup();
            await audioLockService.forceRelease();
            console.log('✅ SummaryScreen cleanup complete');
          } catch (e) {
            console.warn('⚠️ SummaryScreen cleanup error:', e);
          }
        });
      };
    }, [])
  );
  const { scaled } = useFontScale();
  const { colors } = useTheme();
  const { lastTranscription, setSummary } = useSummary();
  const { checkedItems, setAll, reset: resetChecklist } = useChecklist();
  const { setCurrentDraftId, setJustExitedDraft } = useReportSession();
  const { setTranscription } = useTranscription();
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
  scope_completed: normalizeScopeStatus(summary?.scope_completed || summary?.outcome),
      
      
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
  const [showDraftSaved, setShowDraftSaved] = useState(false);
  const [draftId, setDraftId] = useState<string | undefined>(route.params?.draftId);
  // Ensure session marks active draft if navigated with draftId
  useEffect(() => {
    if (route.params?.draftId) {
      setCurrentDraftId(route.params.draftId);
    }
  }, [route.params?.draftId]);
  const [emailRecipients, setEmailRecipients] = useState<string[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [hasAutoSent, setHasAutoSent] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showScopeStatusPicker, setShowScopeStatusPicker] = useState(false);
  // Track recent AI updates (field -> timestamp)
  const [aiFieldUpdates, setAiFieldUpdates] = useState<Record<string, number>>({});
  const [fieldHistory, setFieldHistory] = useState<Record<string, { previous?: string; current: string }>>({});
  const [fieldHistoryMeta, setFieldHistoryMeta] = useState<Record<string, number>>({});
  // Signal for external saves (e.g., DraftSaveButton) to refresh isDirty immediately
  const [saveSignal, setSaveSignal] = useState(0);

  // Auto-save drafts for safety
  const { lastSaved, isDirty, saveNow } = useAutoSave(editableSummary, {
    draftId,
    workOrder: editableSummary.work_order,
    location: editableSummary.location,
    transcription: editableTranscription,
    enabled: true,
    interval: 30000,
    currentRoute: 'Summary',
    checklist: checkedItems,
    externalSaveSignal: saveSignal,
  });

  // Hydrate from saved draft if params are missing
  useEffect(() => {
    (async () => {
      try {
        const missingSummary = !route.params?.summary || Object.values(route.params?.summary || {}).every(v => (v ?? '').toString().trim() === '');
        const missingTrans = !route.params?.transcription || (route.params?.transcription || '').trim() === '';
        if ((missingSummary || missingTrans) && draftId) {
          const d = await draftService.getDraftById(draftId);
          if (d) {
            if (missingSummary && d.summary) setEditableSummary(initializeCloseoutSummary(d.summary));
            if (missingTrans && d.transcription) setEditableTranscription(d.transcription);
            // If checklist isn't present in context (empty), seed from draft
            if (d.checklist) {
              try { setAll(d.checklist); } catch {}
            }
          }
        }
      } catch {}
    })();
  }, [draftId]);

  // Customize back button to go to Transcript when in a draft session
  useLayoutEffect(() => {
    if (!draftId) return;
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={async () => {
            try {
              // Prefer current editable transcription; if empty, hydrate from saved draft
              let text = (editableTranscription || '').trim();
              if (!text) {
                const d = await draftService.getDraftById(draftId);
                if (d?.transcription) text = d.transcription;
              }
              // Replace Summary with Transcript so back from Transcript goes to Home
              // @ts-ignore navigation.replace is available on native stack
              navigation.replace('Transcript', { transcription: text, draftId });
            } catch {
              // @ts-ignore
              navigation.replace('Transcript', { transcription: editableTranscription || '', draftId });
            }
          }}
          style={{ paddingHorizontal: 10, paddingVertical: 6 }}
        >
          <Ionicons name="chevron-back" size={22} color={colors.accent} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, draftId, editableTranscription, colors.accent]);

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

  // Build complete screen context for AI Agent
  const buildScreenContext = (): ScreenContext => {
    return {
      screenName: 'summary',
      mode: 'edit',
      visibleFields: [
        {
          name: 'onsite_contact',
          label: 'Who did you meet on-site?',
          type: 'text',
          currentValue: editableSummary.onsite_contact || '',
          isEditable: true,
          synonyms: ['onsite', 'contact', 'met with', 'onsite contact', 'site contact']
        },
        {
          name: 'work_order',
          label: 'Work Order #',
          type: 'text',
          currentValue: editableSummary.work_order || '',
          isEditable: true,
          synonyms: ['work order', 'wo', 'ticket number', 'job number', 'order number']
        },
        {
          name: 'location',
          label: 'Location',
          type: 'text',
          currentValue: editableSummary.location || '',
          isEditable: true,
          synonyms: ['location', 'site', 'store', 'facility', 'address', 'place']
        },
        {
          name: 'technician_name',
          label: 'Technician Name',
          type: 'text',
          currentValue: editableSummary.technician_name || '',
          isEditable: true,
          synonyms: ['technician', 'tech name', 'my name', 'installer', 'tech']
        },
        {
          name: 'support_contact',
          label: 'Who did you work with for support?',
          type: 'text',
          currentValue: editableSummary.support_contact || '',
          isEditable: true,
          synonyms: ['support', 'support contact', 'it contact', 'helped by', 'support person']
        },
        {
          name: 'work_completed',
          label: 'What work was completed?',
          type: 'multiline',
          currentValue: editableSummary.work_completed || '',
          isEditable: true,
          synonyms: ['work', 'completed', 'tasks', 'work done', 'installed', 'work completed']
        },
        {
          name: 'delays',
          label: 'Were there any delays?',
          type: 'text',
          currentValue: editableSummary.delays || '',
          isEditable: true,
          synonyms: ['delays', 'delay', 'delayed', 'hold ups', 'wait time']
        },
        {
          name: 'troubleshooting_steps',
          label: 'What troubleshooting steps did you take?',
          type: 'multiline',
          currentValue: editableSummary.troubleshooting_steps || '',
          isEditable: true,
          synonyms: ['troubleshooting', 'troubleshooting steps', 'diagnostic steps', 'diagnostics', 'troubleshoot', 'tested', 'checked']
        },
        {
          name: 'scope_completed',
          label: 'Was the scope completed successfully?',
          type: 'text',
          currentValue: editableSummary.scope_completed || '',
          isEditable: true,
          synonyms: ['scope', 'scope completed', 'finished', 'completed successfully', 'done', 'job complete']
        },
        {
          name: 'released_by',
          label: 'Who released you?',
          type: 'text',
          currentValue: editableSummary.released_by || '',
          isEditable: true,
          synonyms: ['released by', 'signed off by', 'released', 'approved by', 'release']
        },
        {
          name: 'release_code',
          label: 'Release Code',
          type: 'text',
          currentValue: editableSummary.release_code || '',
          isEditable: true,
          synonyms: ['release code', 'confirmation code', 'reference number', 'ticket', 'code']
        },
        {
          name: 'return_tracking',
          label: 'Return Tracking #',
          type: 'text',
          currentValue: editableSummary.return_tracking || '',
          isEditable: true,
          synonyms: ['return tracking', 'tracking number', 'shipping', 'rma', 'tracking']
        },
        {
          name: 'expenses',
          label: 'Expenses',
          type: 'text',
          currentValue: editableSummary.expenses || '',
          isEditable: true,
          synonyms: ['expenses', 'costs', 'parking', 'tolls', 'spent', 'money']
        },
        {
          name: 'materials_used',
          label: 'Materials Used',
          type: 'text',
          currentValue: editableSummary.materials_used || '',
          isEditable: true,
          synonyms: ['materials', 'materials used', 'parts', 'equipment', 'supplies', 'used']
        },
        {
          name: 'out_of_scope_work',
          label: 'Out of Scope Work',
          type: 'multiline',
          currentValue: editableSummary.out_of_scope_work || '',
          isEditable: true,
          synonyms: ['out of scope', 'additional work', 'extra work', 'beyond scope', 'additional']
        },
        {
          name: 'photos_uploaded',
          label: 'Photos Uploaded',
          type: 'text',
          currentValue: editableSummary.photos_uploaded || '',
          isEditable: true,
          synonyms: ['photos', 'photos uploaded', 'pictures', 'images', 'pics', 'photo']
        },
        {
          name: 'transcription',
          label: 'Original Transcript',
          type: 'multiline',
          currentValue: editableTranscription || '',
          isEditable: false,
          synonyms: ['transcript', 'transcription', 'recording', 'original', 'original transcript']
        }
      ],
      currentValues: {
        onsite_contact: editableSummary.onsite_contact || '',
        work_order: editableSummary.work_order || '',
        location: editableSummary.location || '',
        technician_name: editableSummary.technician_name || '',
        support_contact: editableSummary.support_contact || '',
        work_completed: editableSummary.work_completed || '',
        delays: editableSummary.delays || '',
        troubleshooting_steps: editableSummary.troubleshooting_steps || '',
        scope_completed: editableSummary.scope_completed || '',
        released_by: editableSummary.released_by || '',
        release_code: editableSummary.release_code || '',
        return_tracking: editableSummary.return_tracking || '',
        expenses: editableSummary.expenses || '',
        materials_used: editableSummary.materials_used || '',
        out_of_scope_work: editableSummary.out_of_scope_work || '',
        photos_uploaded: editableSummary.photos_uploaded || '',
        transcription: editableTranscription || ''
      },
      availableActions: ['update_field', 'update_fields', 'execute_action']
    };
  };

  // Detect if the current transcription differs from the one used to generate the last summary
  const needsRegenerate = React.useMemo(() => {
    const baseline = (lastTranscription ?? route.params?.transcription ?? '').trim();
    const current = (editableTranscription ?? '').trim();
    return baseline !== '' && current !== '' && baseline !== current;
  }, [lastTranscription, route.params?.transcription, editableTranscription]);

  const handleRegenerate = async () => {
    if (!editableTranscription?.trim()) return;
    setIsRegenerating(true);
    try {
      const response = await generateSummary(editableTranscription);
      let newSummary: CloseoutSummary;
      if (response && typeof response === 'object' && 'summary' in response) {
        newSummary = (response as any).summary as CloseoutSummary;
      } else {
        newSummary = response as CloseoutSummary;
      }
      // Normalize with initializer for consistent fields
      const normalized = initializeCloseoutSummary(newSummary);
      setEditableSummary(normalized);
      // Persist in session cache so back/forward preserves it
      try { setSummary(normalized, editableTranscription || ''); } catch {}
    } catch (e) {
      Alert.alert('Error', 'Failed to regenerate summary. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const updateSummaryField = (field: keyof CloseoutSummary, value: string) => {
    setEditableSummary(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSendEmail = async () => {
    // Require Scope Status selection before sending email
    const scopeStatus = (editableSummary.scope_completed || '').trim();
    if (!scopeStatus || !SCOPE_STATUS_OPTIONS.includes(scopeStatus)) {
      Alert.alert(
        'Scope Status required',
        'Please select a Scope Status before sending the email.',
        [
          { text: 'Select Status', onPress: () => setShowScopeStatusPicker(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }
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

      // If this Summary originated from a draft, remove the draft once successfully sent
      try {
        const did = draftId || route.params?.draftId;
        if (did) {
          await draftService.deleteDraft(did);
        }
      } catch (e) {
        console.warn('Failed to delete draft after send', e);
      }

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

  const handleSaveDraft = async () => {
    try {
      await draftService.addDraft({
        id: draftId,
        workOrder: editableSummary.work_order,
        location: editableSummary.location,
        transcription: editableTranscription,
        summary: editableSummary,
        lastSavedRoute: 'Summary',
        checklist: checkedItems,
      });
      setShowDraftSaved(true);
    } catch (e) {
      alert('Failed to save draft');
    }
  };

  // Auto-send email if requested by navigation param
  useEffect(() => {
    const shouldAutoSend = route.params?.autoSendEmail === true;
    if (shouldAutoSend && !hasAutoSent && !isSendingEmail) {
      setHasAutoSent(true);
      // Defer slightly so UI mounts before sending
      setTimeout(() => {
        handleSendEmail().catch(err => {
          console.warn('Auto-send email failed:', err);
        });
      }, 250);
    }
  }, [route.params?.autoSendEmail, hasAutoSent, isSendingEmail]);

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

  // AI Action handler for execute_action (with detailed diagnostics)
  const handleAIAction = async (actionName: string, params?: any) => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('🎯 handleAIAction CALLED');
    console.log('🎯 Action name:', actionName);
    console.log('🎯 Params:', params);
    console.log('🎯 typeof handleSendEmail:', typeof handleSendEmail);
    // Optional scope check
    console.log('🔍 SCOPE CHECK:');
    console.log('  - handleSendEmail available?', typeof handleSendEmail);
    console.log('  - isSendingEmail available?', typeof isSendingEmail);
    console.log('  - setIsSendingEmail available?', typeof setIsSendingEmail);
    console.log('═══════════════════════════════════════════════════════');

    try {
      const a = (actionName || '').toLowerCase();
      if (a === 'send_email' || a === 'send email' || a === 'send_email_report' || a === 'send email report' || a === 'email' || a === 'email_report') {
        console.log('📧 MATCHED: send_email action');
        console.log('📧 About to call handleSendEmail()...');
        console.log('📧 handleSendEmail exists?', typeof handleSendEmail === 'function');

        if (typeof handleSendEmail !== 'function') {
          console.error('❌ CRITICAL: handleSendEmail is not a function!');
          console.error('❌ handleSendEmail value:', handleSendEmail);
          return;
        }

        console.log('📧 Calling handleSendEmail() NOW...');
        const result = await handleSendEmail();
        console.log('📧 handleSendEmail() returned:', result);
        console.log('✅ Email send completed via AI');
        return;
      }
      if (a === 'generate_summary' || a === 'generate closeout' || a === 'create summary') {
        console.log('🧾 Generate summary action received (no-op)');
        return;
      }
      console.warn('⚠️ Unknown AI action:', actionName);
    } catch (error) {
      console.error(`❌ EXCEPTION in handleAIAction for '${actionName}':`, error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown',
        stack: error instanceof Error ? error.stack : 'N/A'
      });
    }

    console.log('═══════════════════════════════════════════════════════');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }] }>
      {/* Editing Draft banner */}
      {!!draftId && (
        <View style={[styles.draftBanner, { borderColor: colors.accent, backgroundColor: colors.surface }]}> 
          <Text style={[styles.draftBannerText, { color: colors.textPrimary }]}>Editing Draft</Text>
          <TouchableOpacity onPress={() => {
            const doExit = () => {
              setShowSuccessPopup(false);
              try { setTranscription(''); } catch {}
              try { resetChecklist(); } catch {}
              try { setSummary({} as any, ''); } catch {}
              setCurrentDraftId(undefined);
              setJustExitedDraft(true);
              navigation.reset({ index: 0, routes: [{ name: 'Home' as any }] });
            };

            if (isDirty) {
              Alert.alert(
                'Unsaved changes',
                'Do you want to save your changes before exiting?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Discard', style: 'destructive', onPress: () => doExit() },
                  { text: 'Save', onPress: async () => { try { const d = await saveNow(); setDraftId(d.id); } catch {}; doExit(); } },
                ]
              );
            } else {
              doExit();
            }
          }} style={[styles.draftExitBtn, { borderColor: colors.accent }]}> 
            <Text style={[styles.draftExitBtnText, { color: colors.accent }]}>Exit Draft</Text>
          </TouchableOpacity>
        </View>
      )}
      {/* Regeneration banner when transcription changed since last generated summary */}
      {needsRegenerate && (
        <View style={[styles.regenBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.regenBannerText, { color: colors.textPrimary, fontSize: scaled(14) }]}>Transcription changed. Regenerate the summary to update fields.</Text>
          <TouchableOpacity
            onPress={handleRegenerate}
            disabled={isRegenerating}
            style={[styles.regenButton, { backgroundColor: colors.accent }, isRegenerating && { opacity: 0.7 }]}
          >
            {isRegenerating ? (
              <ActivityIndicator size="small" color={colors.accentContrast} />
            ) : (
              <Text style={[styles.regenButtonText, { color: colors.accentContrast, fontSize: scaled(14) }]}>Regenerate</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
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

          {/* Scope Status - dropdown selector */}
          <View style={styles.fieldContainer}>
            <Text style={[styles.fieldLabel, { fontSize: scaled(14), color: colors.textSecondary, marginBottom: 8 }]}>Scope Status</Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Select scope status"
              onPress={() => setShowScopeStatusPicker(true)}
              style={[styles.dropdownBox, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            >
              <Text style={{ color: colors.textPrimary, fontSize: scaled(16) }}>
                {editableSummary.scope_completed?.trim() ? editableSummary.scope_completed : 'Select status'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
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

        {/* Auto-save status + SEND/SAVE BUTTONS */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accent }, isSendingEmail && styles.buttonDisabled]}
            onPress={handleSendEmail}
            disabled={isSendingEmail}
          >
            {isSendingEmail ? (
              <ActivityIndicator color={colors.accentContrast || '#fff'} size="small" />
            ) : (
              <Text style={[styles.buttonText, { fontSize: scaled(16), color: colors.accentContrast || '#fff' }]}>Send Email Report</Text>
            )}
          </TouchableOpacity>
          <DraftSaveButton
            data={editableSummary}
            draftId={draftId}
            workOrder={editableSummary.work_order}
            location={editableSummary.location}
            transcription={editableTranscription}
            checklist={checkedItems}
            onSaved={(id) => { setDraftId(id); setCurrentDraftId(id); setShowDraftSaved(true); setSaveSignal(x => x + 1); }}
            style={styles.secondaryButton}
            disabled={!isDirty || isSendingEmail}
            currentRoute="Summary"
          />
        </View>
        {/* Save status indicator (single source of truth: the Save button above) */}
        <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
          {isDirty ? (
            <Text style={{ color: colors.textSecondary }}>• Unsaved changes</Text>
          ) : lastSaved ? (
            <Text style={{ color: colors.textSecondary }}>Saved {lastSaved.toLocaleTimeString()}</Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Email Success Popup */}
      <EmailSuccessPopup
        visible={showSuccessPopup}
        emailList={emailRecipients}
        onComplete={handleSuccessComplete}
      />

      {/* Draft Saved Popup */}
      <DraftSavedPopup
        visible={showDraftSaved}
        workOrder={editableSummary.work_order}
        onComplete={() => setShowDraftSaved(false)}
      />

      {/* AI Agent - Floating button always visible */}
      <AIAgent
        screenContext={buildScreenContext()}
        onFieldUpdate={handleFieldUpdate}
        onAction={handleAIAction}
        position="bottom-center"
        showDebugInfo={false}
      />

      {/* Scope Status Picker Modal */}
      <Modal
        visible={showScopeStatusPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScopeStatusPicker(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowScopeStatusPicker(false)}
          style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onStartShouldSetResponder={() => true}
          >
            <Text style={[styles.modalTitle, { color: colors.textPrimary, fontSize: scaled(16), borderBottomColor: colors.border }]}>Select Scope Status</Text>
            {SCOPE_STATUS_OPTIONS.map(opt => {
              const selected = (editableSummary.scope_completed || '').trim() === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={styles.modalItem}
                  onPress={() => {
                    updateSummaryField('scope_completed', opt);
                    setShowScopeStatusPicker(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${opt}`}
                >
                  <Text style={{ flex: 1, color: colors.textPrimary, fontSize: scaled(15) }}>{opt}</Text>
                  {selected && <Ionicons name="checkmark" size={18} color={colors.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  draftBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  draftBannerText: { fontWeight: '700' },
  draftExitBtn: { paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderRadius: 8 },
  draftExitBtnText: { fontWeight: '700' },
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 30,
    marginTop: 10,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Regenerate banner styles
  regenBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  regenBannerText: {
    flex: 1,
    marginRight: 10,
    fontWeight: '500',
  },
  regenButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  regenButtonText: {
    fontWeight: '700',
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
  dropdownBox: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalTitle: {
    fontWeight: '700',
    paddingVertical: 10,
    borderBottomWidth: 1,
    marginBottom: 6,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
});