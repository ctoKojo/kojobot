export type RecipientMode = 'parent' | 'student' | 'both' | 'smart';
export type SendChannel = 'email' | 'telegram' | 'both';

export interface ParentInfo {
  parent_id: string;
  full_name: string;
  email: string | null;
  has_telegram?: boolean;
}

export interface StudentRow {
  user_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  age_group_id: string | null;
  age_group_name?: string | null;
  group_id?: string | null;
  group_name?: string | null;
  level_id?: string | null;
  level_name?: string | null;
  subscription_status?: 'active' | 'expired' | 'suspended' | 'completed' | 'none' | null;
  subscription_end_date?: string | null;
  has_telegram?: boolean;
  parents: ParentInfo[];
}

export interface StudentFilters {
  search: string;
  groupIds: string[];
  levelIds: string[];
  ageGroupIds: string[];
  subscriptionStatuses: Array<'active' | 'needs_renewal' | 'expired' | 'none'>;
  noParent: boolean;
  hideNoEmail: boolean;
}

export interface CatalogEvent {
  event_key: string;
  display_name_en: string;
  display_name_ar: string;
  category: string;
  available_variables: Array<{ key: string; label_en: string; label_ar: string }>;
}

export interface SendResult {
  studentId: string;
  studentName: string;
  recipientType: 'parent' | 'student' | 'none';
  recipientName: string;
  email: string;
  channel?: 'email' | 'telegram';
  status: 'success' | 'failed' | 'skipped';
  message?: string;
}

export const DEFAULT_FILTERS: StudentFilters = {
  search: '',
  groupIds: [],
  levelIds: [],
  ageGroupIds: [],
  subscriptionStatuses: [],
  noParent: false,
  hideNoEmail: true,
};
