export interface CreateEmployeeInput {
  full_name: string;
  email: string;
  password: string;
  role_id: string;
  mobile?: string | undefined;
  department_id?: string | undefined;
  centre_id?: string | undefined;
  shift_id?: string | undefined;
  team_leader_id?: string | undefined;
  manager_id?: string | undefined;
  designation?: string | undefined;
  joining_date?: string | undefined;
}

export interface EmployeeResponse {
  id: string;
  auth_user_id: string;
  employee_code: string;
  full_name: string;
  email: string;
  mobile?: string | null;
  department_id?: string | null;
  role_id?: string | null;
  centre_id?: string | null;
  shift_id?: string | null;
  designation?: string | null;
  zulip_provisioned: boolean;
  zulip_user_id?: number | null;
  employment_status: string;
  created_at: string;
  updated_at: string;
}
