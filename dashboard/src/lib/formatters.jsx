import { format, parseISO, startOfWeek } from 'date-fns';

export const formatCurrency = (value = 0) => {
  const num = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
  return (
    <span className="currency-wrap" style={{ whiteSpace: 'nowrap' }}>
      {num} <img src="/omr_symbol.png" alt="OMR" style={{ height: '0.9em', verticalAlign: 'baseline', opacity: 0.8 }} />
    </span>
  );
};

export const formatCurrencyStr = (value = 0) => {
  const num = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0);
  return `${num} OMR`;
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'MMM d, HH:mm');
};

export const formatDate = (value) => {
  if (!value) return '—';
  const date = typeof value === 'string' ? parseISO(value) : value;
  return format(date, 'MMM d');
};

export const compactNumber = (value = 0) =>
  new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);

export const weeklyBuckets = (receipts = []) => {
  const groups = {};
  receipts.forEach((r) => {
    const date = typeof r.created_at === 'string' ? parseISO(r.created_at) : new Date(r.created_at);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const key = format(weekStart, 'yyyy-MM-dd');
    groups[key] = groups[key] || { week: key, total: 0, count: 0 };
    groups[key].total += Number(r.subtotal || r.amount || 0);
    groups[key].count += 1;
  });
  return Object.values(groups).sort((a, b) => (a.week > b.week ? 1 : -1));
};
