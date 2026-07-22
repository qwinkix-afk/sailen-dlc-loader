import { useState } from "react";
import { CheckCircle, Crown, KeyRound, Loader } from "lucide-react";

export default function PremiumPage({ authActivated, onAuthActivated }) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await window.launcherApi.authActivate(key.trim());
      if (result.success) {
        onAuthActivated();
      } else {
        setError(result.error || "Ошибка активации");
      }
    } catch {
      setError("Ошибка подключения");
    } finally {
      setLoading(false);
    }
  };

  if (authActivated) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle size={48} className="text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Premium активирован</h2>
          <p className="text-zinc-400">Все премиум-функции доступны</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full rounded-xl bg-gradient-to-br from-yellow-500/20 to-amber-600/20">
            <Crown size={32} className="text-yellow-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold text-white">Premium версия</h2>
          <p className="text-zinc-400">Введите ключ активации для доступа к премиум-функциям</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="relative mb-4">
            <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Введите ключ активации"
              className="w-full rounded-xl border border-white/10 bg-white/5 py-3.5 pl-12 pr-4 text-center text-lg tracking-widest uppercase text-white placeholder-zinc-500 transition-colors focus:border-[var(--accent)] focus:outline-none"
              disabled={loading}
            />
          </div>
          {error && <div className="mb-4 text-center text-sm text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-yellow-500 to-amber-600 py-3.5 font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {loading ? <Loader size={18} className="animate-spin" /> : <Crown size={18} />}
            {loading ? "Активация..." : "Активировать"}
          </button>
        </form>
      </div>
    </div>
  );
}
