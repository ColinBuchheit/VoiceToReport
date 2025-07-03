// types/aiAgent.ts
export interface ScreenContext {
  screenName: 'home' | 'transcript' | 'summary' | 'pdfPreview';
  visibleFields: FieldInfo[];
  currentValues: Record<string, any>;
  availableActions: string[];
  mode?: 'edit' | 'preview';
}

export interface FieldInfo {
  name: string;
  label: string;
  currentValue: string;
  type: 'text' | 'multiline' | 'readonly';
  isEditable: boolean;
  synonyms: string[];
}

export interface VoiceCommand {
  transcription: string;
  screenContext: ScreenContext;
}

export interface VoiceCommandResponse {
  action: 'update_field' | 'navigate' | 'toggle_mode' | 'clarify' | 'execute_action';
  target?: string;
  value?: string;
  confidence: number;
  clarification?: string;
  confirmation: string;
  ttsText: string;
}

export interface AIAgentState {
  isListening: boolean;
  isProcessing: boolean;
  isPlayingResponse: boolean;
  lastResponse?: string;
  error?: string;
}

export interface AIAgentProps {
  screenContext: ScreenContext;
  onFieldUpdate?: (fieldName: string, value: string) => void;
  onModeToggle?: () => void;
  onNavigate?: (screen: string, params?: any) => void;
  onAction?: (actionName: string, params?: any) => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  disabled?: boolean;
}