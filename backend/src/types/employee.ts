export interface CreateEmployeeInput {
  full_name: string;
  alias?: string | undefined;
  email: string;
  password: string;
  role_id?: string | undefined;
  role_key?: string | undefined;
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
  alias?: string | null;
  email: string;
  mobile?: string | null;
  department_id?: string | null;
  role_id?: string | null;
  department?: string | null;
  role?: string | null;
  centre_id?: string | null;
  shift_id?: string | null;
  designation?: string | null;
  joining_date?: string | null;
  zulip_provisioned: boolean;
  zulip_user_id?: number | null;
  employment_status: string;
  created_at: string;
  updated_at: string;
}

export interface EmployeeFilters {
  search?: string | undefined;
  department_id?: string | undefined;
  role_key?: string | undefined;
  status?: string | undefined;
}

export interface UpdateEmployeeInput {
  full_name?: string | undefined;
  alias?: string | undefined;
  designation?: string | undefined;
  department_id?: string | null | undefined;
  role_id?: string | undefined;
  role_key?: string | undefined;
  mobile?: string | undefined;
  employment_status?: string | undefined;
  shift_id?: string | null | undefined;
  centre_id?: string | null | undefined;
  new_password?: string | undefined;
}

