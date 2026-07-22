const typeClasses = {
  Vanilla: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  Forge: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  Fabric: "bg-sky-500/20 text-sky-300 border-sky-500/30"
};

export default function VersionsPage({ versions, versionsLoading, versionsError, selectedVersion, onSelectVersion }) {
  return (
    <section className="h-full bg-[#0B0D18]">
      <div className="drag-region h-12 border-b border-white/5" />
      <div className="p-6">
        <h2 className="mb-6 text-2xl font-bold text-white">Выбор версии</h2>

        {versionsLoading && <p className="text-zinc-300">Загрузка клиентов...</p>}
        {versionsError && !versionsLoading && <p className="text-rose-300">{versionsError}</p>}

        {!versionsLoading && !versionsError && versions.length === 0 && (
          <p className="text-zinc-300">Клиенты не найдены в JSON.</p>
        )}

        {!versionsLoading && versions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {versions.map((version) => {
              const isSelected = selectedVersion === version.name;
              const badgeClass = typeClasses[version.type] || typeClasses.Forge;
              return (
                <button key={version.id || version.name} className="no-drag text-left" onClick={() => onSelectVersion(version.name)}>
                  <article
                    className="rounded-[14px] border border-zinc-800/90 bg-zinc-950/45 p-4 transition hover:translate-y-[-2px] hover:border-[var(--accent)]"
                    style={
                      isSelected
                        ? {
                            borderColor: "var(--accent)",
                            boxShadow: "0 0 24px var(--accent-glow)"
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold text-zinc-50">{version.name}</h3>
                      <span className={`rounded-full border px-2 py-1 text-xs ${badgeClass}`}>{version.type || "Forge"}</span>
                    </div>
                    <p className="mt-4 text-sm text-zinc-300">{version.status || "Сборка"}</p>
                  </article>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
