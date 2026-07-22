import { useState } from "react";
import avatarSrc from "../assets/photo_2026-07-01_13-25-28.jpg";

export default function LoginPage({ onLogin, theme }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Введите логин и пароль");
      return;
    }
    setLoading(true);
    try {
      const result = await window.launcherApi.login(username, password);
      if (result.success) {
        onLogin(result.username);
      } else {
        setError(result.error || "Ошибка входа");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    try {
      await window.launcherApi.register();
    } catch {}
  };

  const accent = theme?.accent || "#8B5CF6";

  return (
    <div
      className="flex h-screen w-screen items-center justify-center"
      style={{ backgroundColor: "#090B16" }}
    >
      <form
        onSubmit={handleLogin}
        className="flex w-[360px] flex-col items-center gap-6 rounded-[16px] border border-white/10 p-10"
        style={{ backgroundColor: "#0C0D1A" }}
      >
        <img
          src={avatarSrc}
          alt="Logo"
          className="h-16 w-16 rounded-[16px] object-cover"
          style={{ boxShadow: `0 8px 32px ${accent}66` }}
        />

        <h1 className="text-xl font-semibold text-white">SailenDLC</h1>

        <div className="flex w-full flex-col gap-3">
          <input
            type="text"
            placeholder="Логин"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-[10px] border border-white/10 bg-[#13152B] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[10px] border border-white/10 bg-[#13152B] px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-white/20"
          />
        </div>

        {error && (
          <p className="w-full text-center text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-[10px] py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: accent }}
        >
          {loading ? "Вход..." : "Войти"}
        </button>

        <button
          type="button"
          onClick={handleRegister}
          className="text-sm text-zinc-400 transition hover:text-white"
        >
          Нет аккаунта? <span style={{ color: accent }}>Зарегистрироваться</span>
        </button>
      </form>
    </div>
  );
}
