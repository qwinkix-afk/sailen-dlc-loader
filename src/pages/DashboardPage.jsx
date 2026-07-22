import { Clock3 } from "lucide-react";
import Button from "../components/Button";

export default function DashboardPage({
  selectedVersion,
  selectedVersionData,
  isInstalled,
  actionLoading,
  actionError,
  installProgress,
  onInstallOrPlay
}) {
  const buttonLabel = actionLoading ? "..." : isInstalled ? "ИГРАТЬ" : "УСТАНОВИТЬ";

  const downloadedMb = (installProgress.downloadedBytes / (1024 * 1024)).toFixed(1);
  const totalMb = installProgress.totalKnown && installProgress.totalBytes > 0
    ? (installProgress.totalBytes / (1024 * 1024)).toFixed(1)
    : null;

  return (
    <section className="relative flex h-full flex-col overflow-hidden bg-[#0B0D18]">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-20 blur-[3px]"
        style={{
          backgroundImage:
            "url('https://fons.grizly.club/uploads/posts/2025-06/04/17490609963636.jpg')"
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[#0B0D18]/75" />

      <header className="drag-region relative z-10 flex h-[64px] items-center justify-between px-10">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <span>Лучший клиент под SpookyTime</span>
        </div>
      </header>

      <main className="relative z-10 flex flex-1 flex-col justify-center px-10 pb-10">
        <div className="max-w-[560px]">
          
          <h1 className="text-[58px] font-black uppercase leading-none text-[#F3F4F6]">
            {selectedVersionData?.title || "SailenClient"}
          </h1>
          <p className="mt-7 text-base leading-relaxed" style={{ color: "#cfd3df" }}>
            {selectedVersionData?.description ||
              "Высокая производительность, плавная работа, эксклюзивный дизайн, регулярные обновления и внимание к каждой детали. Всё создано для максимально комфортной игры."}
          </p>
          <div className="mt-10 flex gap-4">
            <Button onClick={onInstallOrPlay} className="disabled:cursor-not-allowed disabled:opacity-70" disabled={actionLoading || !selectedVersionData}>
              {buttonLabel}
            </Button>
          </div>
          {actionLoading && installProgress.phase === "download" && (
            <div className="mt-4 max-w-[260px]">
              <div className="mb-2 text-xs text-zinc-300">
                Скачивание клиента: {Math.round(installProgress.percent)}%
                {totalMb ? ` (${downloadedMb} / ${totalMb} MB)` : ` (${downloadedMb} MB)`}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.max(0, Math.min(100, installProgress.percent))}%`,
                    backgroundImage: "linear-gradient(90deg, var(--accent-dark), var(--accent))"
                  }}
                />
              </div>
            </div>
          )}
          {actionLoading && installProgress.phase === "extract" && (
            <p className="mt-4 text-sm text-zinc-300">Распаковка клиента...</p>
          )}
          {actionError && <p className="mt-4 text-sm text-rose-300">{actionError}</p>}
        </div>
      </main>

      <footer className="relative z-10 no-drag flex h-[82px] items-center justify-between border-t border-white/5 px-10">
        <div className="flex items-center gap-2 text-sm text-[#A9ACB9]">
          <Clock3 size={16} />
          <span>Версия {selectedVersion}</span>
        </div>
        <div className="flex h-8 items-center rounded-[10px] bg-[#0A0B14] px-4 text-xs text-[#B0B3C2]">
          <span
            className="mr-3 rounded px-2 py-0.5 text-[10px] font-extrabold text-white"
            style={{ backgroundColor: "var(--accent-dark)" }}
          >
            НОВОСТЬ
          </span>
          Выберите клиент во вкладке Версии и запустите установку.
        </div>
      </footer>
    </section>
  );
}
