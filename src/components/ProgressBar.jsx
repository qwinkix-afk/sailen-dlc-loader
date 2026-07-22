export default function ProgressBar({ value, max, label }) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-zinc-300">
        <span>{label}</span>
        <span className="font-medium" style={{ color: "var(--accent)" }}>
          {value} GB
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-zinc-800/80">
        <div
          className="h-full rounded-full transition-all duration-200"
          style={{
            width: `${percentage}%`,
            backgroundImage: "linear-gradient(90deg, var(--accent-dark), var(--accent))",
            boxShadow: "0 0 20px var(--accent-glow)"
          }}
        />
      </div>
    </div>
  );
}
