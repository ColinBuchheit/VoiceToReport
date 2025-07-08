// hooks/useScreenContext.ts - SIMPLIFIED & FLEXIBLE VERSION
import { useMemo } from 'react';
import { ScreenContext, FieldInfo } from '../types/aiAgent';

// Basic Summary Screen Context Hook - Easy to adapt later
export const useSummaryScreenContext = (
  editableSummary: any,
  isPreviewMode: boolean,
  editableTranscription: string
): ScreenContext => {
  return useMemo(() => {
    // Basic fields that can be easily expanded when manager defines requirements
    const fields: FieldInfo[] = [
      {
        name: 'taskDescription',
        label: 'Task Description', 
        currentValue: editableSummary.taskDescription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['task', 'description', 'work', 'job', 'what did you do']
      },
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
        name: 'outcome',
        label: 'Outcome',
        currentValue: editableSummary.outcome || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['outcome', 'result', 'status', 'how did it go']
      },
      {
        name: 'notes',
        label: 'Notes',
        currentValue: editableSummary.notes || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['notes', 'comments', 'additional', 'other']
      },
      {
        name: 'transcription',
        label: 'Transcription',
        currentValue: editableTranscription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['transcription', 'transcript', 'recording', 'what I said']
      }
    ];

    const availableActions = [
      'switch to edit mode',
      'switch to preview mode', 
      'generate PDF',
      'add current date',
      'add current time'
    ];

    return {
      screenName: 'summary',
      visibleFields: fields,
      currentValues: {
        ...editableSummary,
        transcription: editableTranscription,
        mode: isPreviewMode ? 'preview' : 'edit'
      },
      availableActions,
      mode: isPreviewMode ? 'preview' : 'edit'
    };
  }, [editableSummary, isPreviewMode, editableTranscription]);
};

// PDF Preview Screen Context Hook
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
      'generate summary',
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
      'start new report'
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

// UTILITY: Easy field configuration for future expansion
export const createCustomField = (
  name: string,
  label: string,
  currentValue: string,
  synonyms: string[],
  type: 'text' | 'multiline' | 'readonly' = 'text',
  isEditable: boolean = true
): FieldInfo => ({
  name,
  label,
  currentValue: currentValue || '',
  type,
  isEditable,
  synonyms
});

// UTILITY: Helper for adding fields when manager defines requirements
export const addFieldsToContext = (
  baseContext: ScreenContext,
  newFields: FieldInfo[]
): ScreenContext => ({
  ...baseContext,
  visibleFields: [...baseContext.visibleFields, ...newFields]
});

// EXAMPLE: How to easily add new fields when requirements are defined
/*
// When your manager defines new fields, just add them like this:

const customFields = [
  createCustomField('priority', 'Priority Level', summary.priority, ['priority', 'urgent', 'important']),
  createCustomField('clientName', 'Client', summary.clientName, ['client', 'customer', 'company']),
  createCustomField('duration', 'Duration', summary.duration, ['duration', 'time spent', 'hours']),
  // Add as many as needed...
];

// Then use in your screen context:
const enhancedContext = addFieldsToContext(baseContext, customFields);
*/