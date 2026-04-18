/**
 * Format a timestamp to 12-hour AM/PM time string
 * @param {string|Date} dateInput
 * @returns {string} e.g. "7:30 AM" or "—" if null
 */
export function formatTime(dateInput) {
  if (!dateInput) return '—';
  try {
    return new Date(dateInput).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

/**
 * Format a timestamp to date + 12-hour AM/PM
 * @param {string|Date} dateInput
 * @returns {string} e.g. "Mon Apr 7, 7:30 AM"
 */
export function formatDateTime(dateInput) {
  if (!dateInput) return '—';
  try {
    return new Date(dateInput).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

/**
 * Format a date only (no time)
 * @param {string|Date} dateInput
 * @returns {string} e.g. "Apr 7, 2025"
 */
export function formatDate(dateInput) {
  if (!dateInput) return '—';
  try {
    return new Date(dateInput).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}
