export interface ZulipCreateUserPayload {
  email: string;
  full_name: string;
  password: string;
}

export interface ZulipUserResponse {
  result: 'success' | 'error';
  msg?: string;
  user_id?: number;
}
