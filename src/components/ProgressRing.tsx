type Props = {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  className?: string;
};

export default function ProgressRing({ value, size = 56, stroke = 3, label, className }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));

  return (
    <div className={`relative inline-flex items-center justify-center ${className || ''}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-clay)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <span className="absolute font-mono text-[10px] tracking-tight text-ink-soft">
        {label ?? `${Math.round(pct * 100)}%`}
      </span>
    </div>
  );
}
