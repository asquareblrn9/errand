/** Strip HTML tags and decode common entities for plain-text display. */
export function stripHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format a naira amount like the web's formatNaira (src/components/design/Amount.tsx):
 * ₦ + en-NG grouping, optional explicit sign, "—" for null/undefined.
 */
export function formatNaira(value: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (value == null || Number.isNaN(value)) return '—';
  const sign = opts.sign ? (value >= 0 ? '+' : '-') : '';
  const abs = Math.abs(value);
  const grouped = abs.toLocaleString('en-NG', { maximumFractionDigits: 2 });
  return `${sign}₦${grouped}`;
}
