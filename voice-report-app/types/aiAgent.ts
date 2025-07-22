// types/aiAgent.ts - Enhanced Types for Natural AI Agent
export interface ScreenContext {
  screenName: 'home' | 'transcript' | 'summary' | 'pdfPreview' | 'closeout_summary' | 'emailConfirmation';
  visibleFields: FieldInfo[];
  currentValues: Record<string, any>;
  availableActions: string[];
  mode?: 'edit' | 'preview';
  conversationHistory?: string[];
  agentCapabilities?: string[];
  timestamp?: string;
}

export interface FieldInfo {
  name: string;
  label: string;
  currentValue: string;
  type: 'text' | 'multiline' | 'readonly' | 'select' | 'datetime';
  isEditable: boolean;
  synonyms: string[];
  placeholder?: string;
  validation?: FieldValidation;
}

export interface FieldValidation {
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  customMessage?: string;
}

export interface VoiceCommand {
  transcription: string;
  screenContext: ScreenContext;
  timestamp?: string;
  confidence?: number;
}

export interface VoiceCommandResponse {
  action: 
    | 'update_field' 
    | 'navigate' 
    | 'toggle_mode' 
    | 'clarify' 
    | 'execute_action'
    | 'explain_capabilities'
    | 'provide_suggestion'
    | 'acknowledge';
  target?: string;
  value?: string;
  confidence: number;
  clarification?: string;
  confirmation: string;
  ttsText: string;
  metadata?: {
    processingTime?: number;
    modelUsed?: string;
    suggestions?: string[];
    relatedFields?: string[];
  };
}

export interface AIAgentState {
  isListening: boolean;
  isProcessing: boolean;
  isPlayingResponse: boolean;
  lastResponse?: string;
  error?: string;
  conversationActive?: boolean;
  capabilities?: AgentCapabilities;
}

export interface AgentCapabilities {
  field_updates: string;
  wording_help: string;
  questions: string;
  voice_control: string;
  context_aware: string;
  [key: string]: string;
}

export interface AIAgentProps {
  screenContext: ScreenContext;
  onFieldUpdate?: (fieldName: string, value: string) => void;
  onModeToggle?: () => void;
  onNavigate?: (screen: string, params?: any) => void;
  onAction?: (actionName: string, params?: any) => void;
  onCustomAction?: (action: string) => void; // Added this missing prop
  onCapabilityExplain?: (capability: string) => void;
  onSuggestionProvided?: (suggestion: string, targetField?: string) => void;
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  disabled?: boolean;
  showDebugInfo?: boolean;
  customStyle?: {
    buttonColor?: string;
    iconColor?: string;
    size?: number;
  };
}

export interface ConversationEntry {
  userInput: string;
  agentResponse: string;
  timestamp: number;
  screenContext: string;
  action: string;
  confidence: number;
}

export interface AgentHealthStatus {
  status: 'healthy' | 'unhealthy' | 'offline' | 'error';
  capabilities: string[];
  backendAvailable: boolean;
  agentPersona: string;
  lastChecked?: string;
  services?: {
    transcription: 'available' | 'unavailable';
    voice_agent: 'available' | 'unavailable';
    tts: 'available' | 'unavailable';
    gpt: 'available' | 'unavailable';
  };
}

// Updated summary structure for closeout reports
export interface CloseoutSummary {
  // Closeout Notes
  onsite_contact?: string;
  support_contact?: string;
  work_completed?: string;
  delays?: string;
  troubleshooting_steps?: string;
  scope_completed?: string;
  released_by?: string;
  release_code?: string;
  return_tracking?: string;
  
  // Expenses
  expenses?: string;
  materials_used?: string;
  
  // Out of Scope
  out_of_scope_work?: string;
  
  // Photos
  photos_uploaded?: string;
  
  // Additional context
  location?: string;
  datetime?: string;
  technician_name?: string;
  
  // Legacy fields for backward compatibility
  taskDescription?: string;
  outcome?: string;
  notes?: string;
}

// Maintain backward compatibility with legacy summary structure
export interface LegacySummary {
  taskDescription: string;
  location?: string;
  datetime?: string;
  outcome?: string;
  notes?: string;
}

export interface ConnectivityTestResult {
  backendReachable: boolean;
  audioPermissions: boolean;
  lastError?: string;
  responseTime?: number;
  backendVersion?: string;
}

export interface TechniciansReport {
  id?: string;
  location: string;
  clientCompany: string;
  servicesPerformed: string[];
  equipmentInvolved: string[];
  issuesEncountered: string[];
  resolutionStatus: 'completed' | 'partial' | 'pending';
  additionalNotes: string;
  durationEstimate: string;
  followUpNeeded: boolean;
  followUpType?: string;
  technicianName?: string;
  dateCompleted?: string;
  timestamp: string;
}

export interface FieldSuggestion {
  fieldName: string;
  currentValue: string;
  suggestedValue: string;
  reason: string;
  confidence: number;
  improvements: string[];
}

export interface AgentPersonality {
  name: string;
  role: string;
  traits: string[];
  communicationStyle: {
    formality: 'casual' | 'professional' | 'mixed';
    verbosity: 'brief' | 'detailed' | 'adaptive';
    empathy: 'high' | 'medium' | 'low';
  };
  expertise: string[];
  limitations: string[];
}

// Utility types for better type safety
export type ActionType = VoiceCommandResponse['action'];
export type ScreenName = ScreenContext['screenName'];
export type FieldType = FieldInfo['type'];
export type AgentStatus = AIAgentState['isListening'] | AIAgentState['isProcessing'] | AIAgentState['isPlayingResponse'];

// Error types for better error handling
export class AIAgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'AIAgentError';
  }
}

export class AudioProcessingError extends AIAgentError {
  constructor(message: string, details?: any) {
    super(message, 'AUDIO_PROCESSING_ERROR', details);
    this.name = 'AudioProcessingError';
  }
}

export class NetworkError extends AIAgentError {
  constructor(message: string, details?: any) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class TranscriptionError extends AIAgentError {
  constructor(message: string, details?: any) {
    super(message, 'TRANSCRIPTION_ERROR', details);
    this.name = 'TranscriptionError';
  }
}

export class TTSError extends AIAgentError {
  constructor(message: string, details?: any) {
    super(message, 'TTS_ERROR', details);
    this.name = 'TTSError';
  }
}

// Validation helpers
export const validateScreenContext = (context: any): context is ScreenContext => {
  return (
    typeof context === 'object' &&
    typeof context.screenName === 'string' &&
    Array.isArray(context.visibleFields) &&
    typeof context.currentValues === 'object' &&
    Array.isArray(context.availableActions)
  );
};

export const validateFieldInfo = (field: any): field is FieldInfo => {
  return (
    typeof field === 'object' &&
    typeof field.name === 'string' &&
    typeof field.label === 'string' &&
    typeof field.currentValue === 'string' &&
    typeof field.type === 'string' &&
    typeof field.isEditable === 'boolean' &&
    Array.isArray(field.synonyms)
  );
};

export const validateVoiceCommandResponse = (response: any): response is VoiceCommandResponse => {
  return (
    typeof response === 'object' &&
    typeof response.action === 'string' &&
    typeof response.confidence === 'number' &&
    typeof response.confirmation === 'string' &&
    typeof response.ttsText === 'string'
  );
};