import { CriteriaCategory } from '../context/ChecklistContext';

// Centralized checklist categories aligned to required order
export const criteriaCategories: CriteriaCategory[] = [
  {
    title: 'Job Details',
    color: '#111827',
    items: [
      { id: 'work_order', label: 'Work Order #', hint: 'Say the work order number clearly', required: true },
      { id: 'location', label: 'Location', hint: 'Say the site, store, or address', required: true },
    ],
  },
  {
    title: 'Service Summary',
    color: '#2563EB',
    items: [
      { id: 'scope_completed', label: 'Scope Status', hint: "Say 'Complete', 'Incomplete – Revisit required', or 'Multi-day scope'", required: true },
      { id: 'checked_in_with', label: 'Checked In With', hint: 'Name the person or desk you checked in with', required: true },
      { id: 'check_in_code', label: 'Check In Code', hint: "Say the check-in code or say 'no code'", required: true },
      { id: 'onsite_contact', label: 'On-Site Contact', hint: 'Name of your on-site contact', required: true },
      { id: 'support_contact', label: 'Support Contact', hint: 'Name of support/IT or remote contact', required: true },
      { id: 'released_by', label: 'Released By', hint: 'Name of person who released/checked you out', required: true },
      { id: 'release_code', label: 'Release Code', hint: "Say the release/authorization/confirmation code or 'no release code'", required: true },
    ],
  },
  {
    title: 'Technical Information',
    color: '#059669',
    items: [
      { id: 'work_completed', label: 'Work Completed', hint: 'Describe all tasks and technical work done', required: true },
      { id: 'troubleshooting_steps', label: 'Troubleshooting Steps', hint: 'Describe diagnostic steps you took', required: true },
      { id: 'delays', label: 'Delays & Issues', hint: "Mention any delays/issues or say 'None'", required: true },
      { id: 'out_of_scope_work', label: 'Out of Scope Work', hint: "Describe out-of-scope work or say 'None'", required: true },
    ],
  },
  {
    title: 'Closeout Details',
    color: '#8B5CF6',
    items: [
      { id: 'return_tracking', label: 'Return Tracking', hint: "Tracking number or say 'None'", required: true },
      { id: 'materials_used', label: 'Materials Used', hint: "List supplied materials or say 'None'", required: true },
      { id: 'expenses', label: 'Expenses', hint: "Parking, tolls, etc., or say 'None'", required: true },
      { id: 'photos_uploaded', label: 'Photos Uploaded', hint: "Number of photos uploaded or say 'None'", required: true },
    ],
  },
];
