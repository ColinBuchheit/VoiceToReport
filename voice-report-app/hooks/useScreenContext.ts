// hooks/useScreenContext.ts
import { useMemo } from 'react';
import { ScreenContext, FieldInfo } from '../types/aiAgent';

// Summary Screen Context Hook
export const useSummaryScreenContext = (
  editableSummary: any,
  isPreviewMode: boolean,
  editableTranscription: string
): ScreenContext => {
  return useMemo(() => {
    const fields: FieldInfo[] = [
      {
        name: 'taskDescription',
        label: 'Task Description',
        currentValue: editableSummary.taskDescription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['task', 'description', 'work description', 'job', 'activity', 'work']
      },
      {
        name: 'location',
        label: 'Location',
        currentValue: editableSummary.location || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['place', 'site', 'address', 'where', 'job site', 'location', 'spot']
      },
      {
        name: 'datetime',
        label: 'Date/Time',
        currentValue: editableSummary.datetime || '',
        type: 'text',
        isEditable: !isPreviewMode,
        synonyms: ['time', 'date', 'when', 'timestamp', 'datetime', 'day']
      },
      {
        name: 'outcome',
        label: 'Outcome',
        currentValue: editableSummary.outcome || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['result', 'completion', 'status', 'finish', 'outcome', 'end result']
      },
      {
        name: 'notes',
        label: 'Additional Notes',
        currentValue: editableSummary.notes || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['additional notes', 'extra notes', 'comments', 'remarks', 'notes']
      },
      {
        name: 'transcription',
        label: 'Full Transcription',
        currentValue: editableTranscription || '',
        type: 'multiline',
        isEditable: !isPreviewMode,
        synonyms: ['transcription', 'transcript', 'full text', 'recording text']
      }
    ];

    const availableActions = [
      'switch to edit mode',
      'switch to preview mode', 
      'generate PDF',
      'update field',
      'modify transcription',
      'clear field',
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
      'go back to edit',
      'regenerate PDF'
    ];

    return {
      screenName: 'pdfPreview',
      visibleFields: fields,
      currentValues: {
        pdfUrl,
        summary,
        hasGeneratedPDF: true
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
        synonyms: ['transcription', 'transcript', 'text', 'recording', 'speech text']
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
      'start new report',
      'help',
      'instructions'
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