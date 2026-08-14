import { describe, it, expect } from 'vitest';
import { buildAttendancePromptMessage } from '../src/builder';

describe('Zulip Bot Message Builder Unit Tests (W-504)', () => {
  it('builds valid Markdown message containing clock app link', () => {
    const msg = buildAttendancePromptMessage('https://clock.company.com');
    expect(msg).toContain('Good morning team!');
    expect(msg).toContain('[🟢 Clock In / Manage Attendance](https://clock.company.com)');
  });
});
