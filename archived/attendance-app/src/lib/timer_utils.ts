export function calculateElapsedSeconds(startTime: Date, currentTime = new Date()): number {
  if (!startTime || isNaN(startTime.getTime())) return 0;
  const diff = currentTime.getTime() - startTime.getTime();
  return Math.max(0, Math.floor(diff / 1000));
}

export function formatSecondsToHHMMSS(totalSeconds: number): string {
  const hrs = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(totalSeconds % 60).padStart(2, '0');
  return `${hrs}:${mins}:${secs}`;
}
