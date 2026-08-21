export function shouldPromptClockOutConfirmation(currentShiftStatus: string): boolean {
  return currentShiftStatus === 'clocked_in' || currentShiftStatus === 'on_break';
}
