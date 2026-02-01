import { clsx } from 'clsx';

export function StatCard({ label, value, hint, icon: Icon, tone = 'neutral', highlight = false }) {
  const finalTone = highlight ? 'accent' : tone;
  return (
    <div className={clsx('card stat', finalTone)}>
      <div className="stat-icon">{Icon ? <Icon size={18} /> : null}</div>
      <div>
        <p className="muted xs">{label}</p>
        <div className="stat-value">{value}</div>
        {hint ? <p className="muted">{hint}</p> : null}
      </div>
    </div>
  );
}
