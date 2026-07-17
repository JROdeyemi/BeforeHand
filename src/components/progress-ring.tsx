type Props = {
  pct: number;
  label: string;
  size?: number;
  strokeWidth?: number;
};

export function ProgressRing({ pct, label, size = 48, strokeWidth = 4 }: Props) {
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ transform: "rotate(-90deg)" }}
          role="img"
          aria-label={`${label}: ${pct}%`}
        >
          {/* Track */}
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-ink/10"
          />
          {/* Arc */}
          <circle
            cx={cx}
            cy={cx}
            r={r}
            fill="none"
            stroke="#d8a24a"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-xs tabular-nums text-ink"
          aria-hidden="true"
        >
          {pct}%
        </span>
      </div>
      <span className="text-xs text-ink-soft">{label}</span>
    </div>
  );
}
