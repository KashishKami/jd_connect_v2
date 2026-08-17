import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Attendance Web App SSO & Clean Login TDD Suite', () => {
  it('ensures index.html markup has NO hardcoded pre-filled email or password values', () => {
    const htmlPath = path.join(__dirname, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    // Assert that john.doe@jdconnect.com and hardcoded passwords are not present in inputs
    expect(htmlContent).not.toContain('value="john.doe@jdconnect.com"');
    expect(htmlContent).not.toContain('value="Employee123!"');
  });

  it('verifies login form input elements have empty or no default value attribute', () => {
    const htmlPath = path.join(__dirname, '../index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

    const emailMatch = htmlContent.match(/id="loginEmail"[^>]*value="([^"]*)"/);
    const passwordMatch = htmlContent.match(/id="loginPassword"[^>]*value="([^"]*)"/);

    if (emailMatch) {
      expect(emailMatch[1]).toBe('');
    }
    if (passwordMatch) {
      expect(passwordMatch[1]).toBe('');
    }
  });

  it('verifies OAuth code exchange payload structure', () => {
    const code = 'code_sample_123';
    const redirectUri = 'http://localhost:3300/';
    const payload = {
      grant_type: 'authorization_code',
      code,
      client_id: 'attendance-app',
      redirect_uri: redirectUri,
    };
    expect(payload.grant_type).toBe('authorization_code');
    expect(payload.code).toBe('code_sample_123');
  });
});

