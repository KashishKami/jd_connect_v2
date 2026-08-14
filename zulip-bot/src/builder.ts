export function buildAttendancePromptMessage(clockAppUrl: string): string {
  return [
    '📋 **Good morning team! Please mark your attendance for today.**',
    '',
    `👉 [🟢 Clock In / Manage Attendance](${clockAppUrl})`,
  ].join('\n');
}
