import { Crown, Home, LogOut, Rows3, Settings } from "lucide-react";
import avatarSrc from "../assets/photo_2026-07-01_13-25-28.jpg";

const navItems = [
  { id: "dashboard", icon: Home, label: "Главная" },
  { id: "versions", icon: Rows3, label: "Версии" },
  { id: "premium", icon: Crown, label: "Premium" },
  { id: "settings", icon: Settings, label: "Настройки" }
];

export default function Sidebar({ currentPage, onNavigate, onExit }) {
  return (
    <aside className="flex w-[82px] flex-col justify-between border-r border-white/5 bg-[#090A14] py-10">
      <div className="space-y-12">
        <img
          src={avatarSrc}
          alt="Logo"
          className="mx-auto h-10 w-10 rounded-[12px] object-cover"
          style={{ boxShadow: "0 8px 24px var(--accent-glow)" }}
        />
        <nav className="flex flex-col items-center gap-6">
          {navItems.map(({ id, icon: Icon, label }) => {
            const active = currentPage === id;
            return (
              <button
                key={id}
                title={label}
                className={`no-drag flex h-12 w-12 items-center justify-center rounded-[12px] transition-all ${
                  active ? "text-white" : "text-zinc-500 hover:text-zinc-200"
                }`}
                style={active ? { backgroundColor: "var(--accent-soft)" } : undefined}
                onClick={() => onNavigate(id)}
              >
                <Icon size={18} strokeWidth={2} />
              </button>
            );
          })}
        </nav>
      </div>

      <button
        title="Exit"
        className="no-drag mx-auto flex h-12 w-12 items-center justify-center rounded-[12px] text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        onClick={onExit}
      >
        <LogOut size={18} />
      </button>
    </aside>
  );
}
