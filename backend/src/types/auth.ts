export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  user?: {
    id: string;
    email: string;
    full_name?: string | undefined;
  } | undefined;
}

export interface AuthUserDetail {
  id: string;
  email: string;
  full_name?: string | undefined;
  password_hash: string;
  is_active: boolean;
  employee_id: string;
  zulip_user_id?: number | null | undefined;
  employment_status: string;
  role_keys: string[];
}
