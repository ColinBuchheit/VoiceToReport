// voice-report-app/hooks/useScreenContext.ts - Updated: Remove preview mode logic
import { useMemo } from 'react';
import { ScreenContext, FieldInfo, CloseoutSummary } from '../types/aiAgent';

// Summary Screen Context Hook - UPDATED: Always in edit mode
export const useSummaryScreenContext = (
  editableSummary: CloseoutSummary,
  isPreviewMode: boolean, // Keep parameter for compatibility but always treat as false
  editableTranscription: string
): ScreenContext => {
  return useMemo(() => {
    const fields: FieldInfo[] = [
      // CLOSEOUT NOTES SECTION
      {
        name: 'onsite_contact',
        label: 'Who did you meet with on-site?',
        currentValue: editableSummary.onsite_contact || '',
        type: 'text',
        isEditable: true, // Always editable
        synonyms: ['onsite contact', 'met with', 'contact person', 'site contact', 'who did you meet']
      },
      {
        name: 'support_contact',
        label: 'Who did you work with for support?',
        currentValue: editableSummary.support_contact || '',
        type: 'text',
        isEditable: true, // Always editable
        synonyms: ['support contact', 'support team', 'worked with', 'remote support', 'help from']
      },
      {
        name: 'work_completed',
        label: 'What work was completed?',
        currentValue: editableSummary.work_completed || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['work completed', 'tasks completed', 'work done', 'completed work', 'what did you do']
      },
      {
        name: 'delays',
        label: 'Were there any delays?',
        currentValue: editableSummary.delays || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['delays', 'delayed', 'problems', 'issues', 'held up', 'late']
      },
      {
        name: 'expenses',
        label: 'What expenses did you incur?',
        currentValue: editableSummary.expenses || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['expenses', 'costs', 'spent', 'parking', 'tolls', 'meals', 'travel costs']
      },
      {
        name: 'materials_used',
        label: 'What materials did you use?',
        currentValue: editableSummary.materials_used || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['materials', 'parts', 'supplies', 'equipment', 'used', 'materials used']
      },
      
      // OUT OF SCOPE SECTION
      {
        name: 'out_of_scope_work',
        label: 'Out of scope work and who approved it',
        currentValue: editableSummary.out_of_scope_work || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['out of scope', 'additional work', 'extra work', 'scope', 'approved by', 'who approved']
      },
      
      // PHOTOS SECTION
      {
        name: 'photos_uploaded',
        label: 'How many photos did you upload?',
        currentValue: editableSummary.photos_uploaded || '',
        type: 'text',
        isEditable: true, // Always editable
        synonyms: ['photos uploaded', 'photos', 'pictures', 'how many photos', 'uploaded photos']
      },
      
      // ADDITIONAL CONTEXT
      {
        name: 'work_order',
        label: 'Work Order #',
        currentValue: editableSummary.work_order || '',
        type: 'text',
        isEditable: true, // Always editable
        synonyms: ['work order', 'order number', 'wo', 'work order number']
      },
      // (Removed) location, datetime, technician_name - not exposed in UI anymore
      
      // LEGACY FIELDS FOR COMPATIBILITY
      {
        name: 'notes',
        label: 'Additional Notes',
        currentValue: editableSummary.notes || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['notes', 'comments', 'additional', 'other', 'extra info', 'remarks']
      },
      {
        name: 'transcription',
        label: 'Original Transcription',
        currentValue: editableTranscription || '',
        type: 'multiline',
        isEditable: true, // Always editable
        synonyms: ['transcription', 'transcript', 'recording', 'what I said']
      }
    ];

    const availableActions = [
      // Removed: 'switch to edit mode', 'switch to preview mode'
      'send email report',
      'generate PDF', // Keep for backward compatibility
      'add current date',
      'add current time',
      'clear field',
      'suggest improvements'
    ];

    return {
      screenName: 'summary',
      visibleFields: fields,
      currentValues: {
        ...editableSummary,
        transcription: editableTranscription,
        mode: 'edit' // Always in edit mode
      },
      availableActions,
      mode: 'edit', // Always in edit mode
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
  }, [editableSummary, editableTranscription]); // Removed isPreviewMode dependency
};