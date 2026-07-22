export default function Button({ children, variant = "primary", className = "", ...props }) {
  const base =
    "no-drag h-[54px] rounded-[13px] px-8 text-sm font-extrabold tracking-[0.01em] transition-all duration-300";

  const variants = {
    primary:
      "min-w-[164px] text-white hover:brightness-110",
    secondary:
      "min-w-[126px] border border-white/6 bg-[#1A1B25] text-zinc-200 hover:border-white/12 hover:bg-[#202231]"
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`.trim()}
      style={
        variant === "primary"
          ? {
              backgroundImage: "linear-gradient(90deg, var(--accent-dark), var(--accent))",
              boxShadow: "0 10px 30px var(--accent-glow)"
            }
          : undefined
      }
      {...props}
    >
      {children}
    </button>
  );
}
