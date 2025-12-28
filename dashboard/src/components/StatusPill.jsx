import { clsx } from 'clsx';

const toneMap = {
  paid: 'success',
  delivered: 'success',
  completed: 'success',
  active: 'success',
  pending: 'amber',
  initiated: 'amber',
  processing: 'info',
  shipped: 'info',
  partial: 'info',
  failed: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  declined: 'danger',
};

export function StatusPill({ value }) {
  if (!value) return <span className="pill">—</span>;
  const key = typeof value === 'string' ? value.toLowerCase() : value;
  const tone = toneMap[key] || 'info';
  return <span className={clsx('pill', tone)}>{value}</span>;
}
