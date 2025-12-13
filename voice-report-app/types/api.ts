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

// Email attachment type
export interface EmailAttachment {
  filename: string;
  content_type: string;
  data_base64: string;
}

export interface CloseoutSummary {
  // Closeout Notes
  onsite_contact?: string;
  support_contact?: string;
  checked_in_with?: string;
  check_in_code?: string;
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
  location?: string;
  technician_name?: string;
  
}

export interface ApiError {
  detail?: string;
  message?: string;
  status?: number;
}

export interface BugImagePayload {
  filename?: string;
  content_type?: string;
  data_base64: string;
}

export interface BugReportRequest {
  description: string;
  reporter_email?: string;
  images?: BugImagePayload[];
}

export interface BugReportResponse {
  success: boolean;
  message: string;
}