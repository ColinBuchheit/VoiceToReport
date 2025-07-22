// hooks/useScreenContext.ts - UPDATED FOR CLOSEOUT REPORTS WITH BACKWARD COMPATIBILITY
import { useMemo } from 'react';
import { ScreenContext, FieldInfo, CloseoutSummary } from '../types/aiAgent';

// Updated Summary Screen Context Hook for Closeout Reports
export const useSummaryScreenContext = (
  editableSummary: CloseoutSummary,
  isPreviewMode: boolean,
  editableTranscription: string
): ScreenContext => {
  return useMemo(() => {
    // Updated fields for closeout report structure with legacy support
    const fields: FieldInfo[] = [
      // CLOSEOUT NOTES SECTION
      {
        name: 'onsite_contact',
        label: 'Who did you meet with on-site?', 
        currentValue: editableSummary.onsite_contact || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['onsite contact', 'who did you meet', 'met with', 'contact', 'person on site']
      },
      {
        name: 'support_contact',
        label: 'Who did you work with for support?',
        currentValue: editableSummary.support_contact || '',
        type: 'text', 
        isEditable: !isPreviewMode,
        synonyms: ['support contact', 'support person', 'who helped', 'worked with for support']
      },
      {
        name: 'work_completed',
        label: 'What work was completed?',
        currentValue: editableSummary.work_completed || editableSummary.taskDescription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['work completed', 'what work', 'completed work', 'tasks completed', 'work done', 'task description']
      },
      {
        name: 'delays',
        label: 'Were there any delays?',
        currentValue: editableSummary.delays || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['delays', 'any delays', 'were there delays', 'problems', 'issues']
      },
      {
        name: 'troubleshooting_steps',
        label: 'What troubleshooting steps did you take?',
        currentValue: editableSummary.troubleshooting_steps || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['troubleshooting', 'troubleshooting steps', 'steps taken', 'debugging', 'problem solving']
      },
      {
        name: 'scope_completed',
        label: 'Was the scope completed successfully?',
        currentValue: editableSummary.scope_completed || editableSummary.outcome || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['scope completed', 'completed successfully', 'scope', 'success', 'finished', 'outcome']
      },
      {
        name: 'released_by',
        label: 'Who released you?',
        currentValue: editableSummary.released_by || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['released by', 'who released', 'release person', 'released me']
      },
      {
        name: 'release_code',
        label: 'Release code (if any)',
        currentValue: editableSummary.release_code || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['release code', 'code', 'release number', 'authorization code']
      },
      {
        name: 'return_tracking',
        label: 'Return tracking number (if any)',
        currentValue: editableSummary.return_tracking || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['return tracking', 'tracking number', 'return number', 'shipping tracking']
      },
      
      // EXPENSES SECTION
      {
        name: 'expenses',
        label: 'Any expenses (parking fees, etc)?',
        currentValue: editableSummary.expenses || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['expenses', 'parking fees', 'costs', 'fees', 'money spent']
      },
      {
        name: 'materials_used',
        label: 'What materials did you use?',
        currentValue: editableSummary.materials_used || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['materials used', 'materials', 'parts', 'supplies', 'equipment used']
      },
      
      // OUT OF SCOPE SECTION
      {
        name: 'out_of_scope_work',
        label: 'Out of scope work (if any) and who approved it',
        currentValue: editableSummary.out_of_scope_work || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['out of scope', 'additional work', 'extra work', 'scope change', 'approved work']
      },
      
      // PHOTOS SECTION
      {
        name: 'photos_uploaded',
        label: 'How many photos did you upload?',
        currentValue: editableSummary.photos_uploaded || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['photos uploaded', 'photos', 'pictures', 'how many photos', 'uploaded photos']
      },
      
      // ADDITIONAL CONTEXT
      {
        name: 'location',
        label: 'Location',
        currentValue: editableSummary.location || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['location', 'place', 'where', 'site', 'address']
      },
      {
        name: 'datetime',
        label: 'Date/Time',
        currentValue: editableSummary.datetime || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['time', 'date', 'when', 'datetime']
      },
      {
        name: 'technician_name',
        label: 'Technician Name',
        currentValue: editableSummary.technician_name || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['technician', 'my name', 'tech name', 'who am I']
      },
      
      // LEGACY FIELDS FOR COMPATIBILITY
      {
        name: 'notes',
        label: 'Additional Notes',
        currentValue: editableSummary.notes || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['notes', 'comments', 'additional', 'other', 'extra info', 'remarks']
      },
      {
        name: 'transcription',
        label: 'Original Transcription',
        currentValue: editableTranscription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['transcription', 'transcript', 'recording', 'what I said']
      }
    ];

    const availableActions = [
      'switch to edit mode',
      'switch to preview mode', 
      'send email report',
      'generate PDF', // Keep for backward compatibility
      'add current date',
      'add current time',
      'clear field',
      'suggest improvements'
    ];

    return {
      screenName: 'summary', // Keep as 'summary' for compatibility, not 'closeout_summary'
      visibleFields: fields,
      currentValues: {
        ...editableSummary,
        transcription: editableTranscription,
        mode: isPreviewMode ? 'preview' : 'edit'
      },
      availableActions,
      mode: isPreviewMode ? 'preview' : 'edit',
      agentCapabilities: [
        'field_updates',
        'wording_help', 
        'questions',
        'voice_control',
        'context_aware',
        'email_sending'
      ],
      timestamp: new Date().toISOString(),
    };
  }, [editableSummary, isPreviewMode, editableTranscription]);
};

// Email Confirmation Screen Context Hook
export const useEmailConfirmationScreenContext = (
  emailResponse: any,
  summary: any
): ScreenContext => {
  return useMemo(() => {
    const fields: FieldInfo[] = []; // No editable fields in email confirmation

    const availableActions = [
      'send another report',
      'create new report',
      'go back to edit'
    ];

    return {
      screenName: 'pdfPreview', // Use existing screen name for compatibility
      visibleFields: fields,
      currentValues: {
        emailResponse,
        summary
      },
      availableActions
    };
  }, [emailResponse, summary]);
};

// Transcript Screen Context Hook  
export const useTranscriptScreenContext = (
  transcription: string,
  isEditing: boolean
): ScreenContext => {
  return useMemo(() => {
    const fields: FieldInfo[] = [
      {
        name: 'transcription',
        label: 'Transcription',
        currentValue: transcription || '',
        type: 'multiline',
        isEditable: isEditing,
        synonyms: ['transcription', 'transcript', 'text', 'recording']
      }
    ];

    const availableActions = [
      'edit transcription',
      'stop editing',
      'generate closeout summary',
      'clear transcription'
    ];

    return {
      screenName: 'transcript',
      visibleFields: fields,
      currentValues: {
        transcription,
        isEditing
      },
      availableActions
    };
  }, [transcription, isEditing]);
};

// Home Screen Context Hook
export const useHomeScreenContext = (
  isRecording: boolean,
  isProcessing: boolean
): ScreenContext => {
  return useMemo(() => {
    const fields: FieldInfo[] = []; // No editable fields on home screen

    const availableActions = [
      'start recording',
      'stop recording',
      'start new closeout report'
    ];

    return {
      screenName: 'home',
      visibleFields: fields,
      currentValues: {
        isRecording,
        isProcessing
      },
      availableActions
    };
  }, [isRecording, isProcessing]);
};

// PDF Preview Screen Context Hook (keeping for backward compatibility)
export const usePDFPreviewScreenContext = (
  pdfUrl: string,
  summary: any
): ScreenContext => {
  return useMemo(() => {
    const fields: FieldInfo[] = []; // No editable fields in PDF preview

    const availableActions = [
      'share PDF',
      'download PDF', 
      'create new report',
      'go back to edit'
    ];

    return {
      screenName: 'pdfPreview',
      visibleFields: fields,
      currentValues: {
        pdfUrl,
        summary
      },
      availableActions
    };
  }, [pdfUrl, summary]);
};

// UTILITY: Easy field configuration for future expansion
export const createCustomField = (
  name: string,
  label: string,
  currentValue: string,
  type: 'text' | 'multiline' = 'text',
  synonyms: string[] = []
): FieldInfo => ({
  name,
  label,
  currentValue,
  type,
  isEditable: true,
  synonyms
});