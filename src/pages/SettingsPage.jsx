import { ChevronDown, FolderOpen, RefreshCw } from "lucide-react";
import ProgressBar from "../components/ProgressBar";
import { useState } from "react";

const totalRam = 16;

export default function SettingsPage({ settings, themes, onSettingsChange, onPickFolder }) {
  const [updateState, setUpdateState] = useState({ status: "idle", text: "" });
  const recommended = settings.ramGb >= 6 && settings.ramGb <= 10 ? "Рекомендуется" : "Проверьте значение";

  return (
    <section className="flex h-full flex-col bg-[#0B0D18]">
      <div className="drag-region h-12 border-b border-white/5" />

      <div className="custom-scroll no-drag flex-1 overflow-y-auto px-6 pb-6">
        <h2 className="mb-6 mt-6 text-2xl font-bold text-white">Настройки</h2>

        <div className="space-y-6 pb-6">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
            <label className="mb-3 block text-sm text-zinc-200">Выделение RAM</label>
            <input
              type="range"
              min={2}
              max={totalRam}
              value={settings.ramGb}
              onChange={(e) => onSettingsChange({ ramGb: Number(e.target.value) })}
              className="fancy-range w-full"
            />
            <div className="mt-3">
              <ProgressBar value={settings.ramGb} max={totalRam} label={`Память (${recommended})`} />
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
            <label className="mb-2 block text-sm text-zinc-200">Путь к папке игры</label>
            <div className="flex gap-2">
              <input
                value={settings.gamePath}
                onChange={(e) => onSettingsChange({ gamePath: e.target.value })}
                className="w-full rounded-[12px] border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-[var(--accent)]"
              />
              <button
                className="rounded-[12px] border border-zinc-700 bg-zinc-900/80 px-3 text-zinc-200 transition hover:border-[var(--accent)]"
                onClick={onPickFolder}
                title="Выбрать папку"
              >
                <FolderOpen size={16} />
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
            <label className="mb-2 block text-sm text-zinc-200">Тема интерфейса</label>
            <div className="relative">
              <select
                value={settings.themeId}
                onChange={(e) => onSettingsChange({ themeId: e.target.value })}
                className="fancy-select w-full appearance-none rounded-[12px] border border-zinc-700 bg-zinc-900/80 px-4 py-2 text-sm text-zinc-100 outline-none transition focus:border-[var(--accent)]"
              >
                {themes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 text-sm text-zinc-200">
            <FancyCheckbox
              label="Закрывать лаунчер после запуска"
              checked={settings.closeAfterLaunch}
              onChange={(value) => onSettingsChange({ closeAfterLaunch: value })}
            />
          </div>

          <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
            <label className="mb-3 block text-sm text-zinc-200">Обновления</label>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/80 px-4 py-2.5 text-sm text-zinc-100 transition hover:border-[var(--accent)] disabled:opacity-40"
              disabled={updateState.status === "checking"}
              onClick={async () => {
                setUpdateState({ status: "checking", text: "Проверка..." });
                try {
                  const check = await window.launcherApi.checkUpdate();
                  if (check.error) { setUpdateState({ status: "error", text: check.error }); return; }
                  const hasRemoteJar = check.jarUrl || check.premiumJarUrl;
                  if (!hasRemoteJar) { setUpdateState({ status: "done", text: "Нет удалённых обновлений" }); return; }
                  setUpdateState({ status: "done", text: `Новые версии джарок доступны (v${check.version}) — установятся при запуске игры` });
                } catch { setUpdateState({ status: "error", text: "Ошибка проверки" }); }
              }}
            >
              <RefreshCw size={16} className={updateState.status === "checking" ? "animate-spin" : ""} />
              {updateState.status === "idle" && "Проверить обновления"}
              {updateState.status === "checking" && "Проверка..."}
              {updateState.status === "done" && updateState.text}
              {updateState.status === "error" && updateState.text}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function FancyCheckbox({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 transition hover:border-[var(--accent)]/60">
      <span
        className="flex h-5 w-5 items-center justify-center rounded-md border border-zinc-600 bg-zinc-900 transition"
        style={checked ? { backgroundColor: "var(--accent)", borderColor: "var(--accent)" } : undefined}
      >
        {checked && <span className="h-2 w-2 rounded-sm bg-white" />}
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      <span>{label}</span>
    </label>
  );
}
