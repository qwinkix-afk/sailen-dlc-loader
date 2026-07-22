import { useState, useEffect } from "react";

export default function KeyActivation({ onActivated }) {
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      if (window.launcherApi?.authStatus) {
        const status = await window.launcherApi.authStatus();
        if (status.activated) onActivated();
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await window.launcherApi.authActivate(key.trim());
      if (result.success) {
        onActivated();
      } else {
        setError(result.error || "Ошибка активации");
      }
    } catch {
      setError("Ошибка подключения к серверу");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090B16]">
      <div className="w-full max-w-md mx-4 p-8 rounded-2xl border border-white/10 bg-[#0E1020]">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-white mb-2">SailenDLC</div>
          <div className="text-zinc-400 text-sm">Требуется активация</div>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Введите ключ активации"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-[var(--accent)] transition-colors mb-4 text-center text-lg tracking-widest uppercase"
            disabled={loading}
          />
          {error && <div className="text-red-400 text-sm text-center mb-4">{error}</div>}
          <button
            type="submit"
            disabled={loading || !key.trim()}
            className="w-full py-3 rounded-xl font-semibold transition-all bg-[var(--accent)] text-black hover:opacity-90 disabled:opacity-40"
          >
            {loading ? "Активация..." : "Активировать"}
          </button>
        </form>
      </div>
    </div>
  );
}
