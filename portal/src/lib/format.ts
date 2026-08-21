/**
 * EST Timezone Formatting Utilities (America/New_York)
 * 12-Hour Format with explicit AM/PM
 */

export function formatESTTime(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return '-';
  }
}

export function formatESTDate(dateOrIsoString?: string | null): string {
  if (!dateOrIsoString) return '-';
  try {
    // Plain YYYY-MM-DD dates should be preserved directly without UTC shift
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOrIsoString)) {
      return dateOrIsoString;
    }
    const d = new Date(dateOrIsoString);
    if (isNaN(d.getTime())) return dateOrIsoString;
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;

    return `${year}-${month}-${day}`;
  } catch {
    return dateOrIsoString;
  }
}
