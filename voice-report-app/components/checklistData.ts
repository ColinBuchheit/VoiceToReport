import { CriteriaCategory } from '../context/ChecklistContext';

// Centralized checklist categories so both Home and Transcript screens can reuse
export const criteriaCategories: CriteriaCategory[] = [
  {
    title: 'Closeout Notes',
    color: '#000000',
    items: [
      { id: 'work_order', label: 'What is the Work Order number?', hint: 'Say the work order number clearly', required: true },
      { id: 'location', label: 'What is the location?', hint: 'Say the site, store, or address', required: true },
      { id: 'onsite_contact', label: 'Who did you meet with on-site?', hint: 'Mention the name of your on-site contact', required: true },
      { id: 'support_contact', label: 'Who did you work with for support?', hint: 'Name the support person or company', required: true },
      { id: 'work_completed', label: 'What work was completed?', hint: 'Describe all tasks and technical work done', required: true },
      { id: 'delays', label: 'Were there any delays?', hint: "Mention any delays or say 'no delays'", required: true },
      { id: 'troubleshooting_steps', label: 'What troubleshooting steps did you take?', hint: 'Describe debugging or problem-solving steps', required: true },
      { id: 'scope_completed', label: 'Was the scope completed successfully?', hint: 'Say yes/no and explain the outcome', required: true },
      { id: 'released_by', label: 'Who released you?', hint: 'Name of person who signed off on completion', required: true },
      { id: 'release_code', label: 'Is there a release code? If so, what is it?', hint: "Mention release code or say 'no release code'", required: true },
      { id: 'return_tracking', label: 'Is there a return tracking number? If so, what is it?', hint: "Mention tracking number or say 'no return tracking'", required: true },
    ],
  },
  {
    title: 'Expenses',
    color: '#10B981',
    items: [
      { id: 'expenses', label: 'Did you have any expenses (parking fees, etc)?', hint: "List any expenses or say 'no expenses'", required: true },
      { id: 'materials_used', label: 'What materials did you use?', hint: "List materials used or say 'no materials used'", required: true },
    ],
  },
  {
    title: 'Out of Scope',
    color: '#F59E0B',
    items: [
      { id: 'out_of_scope_work', label: 'Was there any out of scope work? If so, what is it and who approved the work?', hint: "Describe out of scope work and approval or say 'no out of scope work'", required: true },
    ],
  },
  {
    title: 'Photos',
    color: '#8B5CF6',
    items: [
      { id: 'photos_uploaded', label: 'How many photos did you upload?', hint: "State number of photos uploaded or say 'no photos uploaded'", required: true },
    ],
  },
];
