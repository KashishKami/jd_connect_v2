export type BreakStatus = 'active' | 'completed' | 'exceeded' | 'cancelled';

export interface BreakType {
  id: string;
  key: string;
  name: string;
  description: string | null;
  default_limit_minutes: number | null;
  tl_alert_minutes: number | null;
  manager_alert_minutes: number | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface BreakRecord {
  id: string;
  employee_id: string;
  break_type_id: string;
  department_id: string | null;
  centre_id: string | null;
  start_at: Date;
  end_at: Date | null;
  duration_minutes: number | null;
  status: BreakStatus;
  limit_minutes: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}
