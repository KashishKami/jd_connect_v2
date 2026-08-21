export type AttendanceStatus =
  | 'logged_in'
  | 'present'
  | 'half_day'
  | 'absent'
  | 'late'
  | 'leave'
  | 'weekly_off'
  | 'holiday';

export type AttendanceSource = 'auto' | 'manual' | 'correction';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  work_date: string;
  clock_in_at: Date | null;
  clock_out_at: Date | null;
  hours_worked: number | null;
  status: AttendanceStatus;
  is_late: boolean;
  source: AttendanceSource;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}
