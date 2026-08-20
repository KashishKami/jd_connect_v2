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

export function formatDateFull(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    // 1. Pure date string "YYYY-MM-DD"
    if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
      const [year, month, day] = isoString.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    // 2. Pure date serialized as UTC midnight ISO string "YYYY-MM-DDT00:00:00..."
    if (typeof isoString === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00/.test(isoString)) {
      const [year, month, day] = isoString.slice(0, 10).split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    // 3. Full TIMESTAMPTZ with non-zero time (e.g. break start_at) -> format in EST/EDT
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
