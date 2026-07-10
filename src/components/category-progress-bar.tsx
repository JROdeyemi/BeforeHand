type Props = {
  answered: number;
  total: number;
};

export function CategoryProgressBar({ answered, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((answered / total) * 100);
  return (
    <div className="mt-2 flex items-center gap-3">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/10">
        <div
          className="h-full rounded-full bg-candle transition-all duration-300"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={answered}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={`${answered} of ${total} answered`}
        />
      </div>
      <span className="text-xs text-ink-soft tabular-nums">
        {answered}/{total}
      </span>
    </div>
  );
}
