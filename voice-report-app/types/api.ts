// voice-report-app/types/api.ts - Missing types file
export interface TranscriptionResponse {
  transcription: string;
  success: boolean;
  message?: string;
}

export interface SummaryResponse {
  summary: CloseoutSummary;
  success: boolean;
  message?: string;
}

export interface EmailResponse {
  success: boolean;
  message: string;
  recipients: string[];
}

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
  
  // Additional fields
  work_order?: string;
  
}

export interface ApiError {
  detail?: string;
  message?: string;
  status?: number;
}