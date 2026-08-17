export function formatHistoryDate(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '-';
  }
}

export function formatDuration(minutes?: number | null): string {
  if (minutes === null || minutes === undefined) return '-';
  return `${minutes} mins`;
}

export function formatStatusBadge(status?: string | null): string {
  if (!status) return '-';
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function formatAttendanceStatus(record: { clock_out_at?: string | null; status?: string | null }): {
  label: string;
  cssClass: string;
} {
  if (!record.clock_out_at) {
    return { label: 'On Shift', cssClass: 'on-shift' };
  }
  const status = record.status || 'present';
  const label = formatStatusBadge(status);
  return { label, cssClass: status };
}

export function formatBreakReason(record: { break_name?: string; break_type_name?: string; break_type_key?: string }): string {
  return record.break_name || record.break_type_name || record.break_type_key || 'Break';
}
