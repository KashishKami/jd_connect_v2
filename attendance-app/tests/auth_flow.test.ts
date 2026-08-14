import { describe, it, expect } from 'vitest';
import { parseTokenFromLocation, getRedirectToSsoUrl } from '../src/auth';

describe('Attendance App Auth Flow (W-501 Integration)', () => {
  it('parses token from URL query string if present', () => {
    const url = 'http://clock.localhost/?token=jwt_sample_token_xyz';
    const token = parseTokenFromLocation(url);
    expect(token).toBe('jwt_sample_token_xyz');
  });

  it('returns null if token parameter is absent in URL', () => {
    const url = 'http://clock.localhost/';
    const token = parseTokenFromLocation(url);
    expect(token).toBeNull();
  });

  it('constructs correct SSO authorization redirect URL', () => {
    const ssoUrl = getRedirectToSsoUrl('http://localhost:4000', 'http://clock.localhost');
    expect(ssoUrl).toBe('http://localhost:4000/oauth/authorize?client_id=zulip&response_type=code&redirect_uri=http%3A%2F%2Fclock.localhost');
  });
});
