import { useEffect, useMemo, useState } from "react";
import Sidebar from "./components/Sidebar";
import DashboardPage from "./pages/DashboardPage";
import SettingsPage from "./pages/SettingsPage";
import VersionsPage from "./pages/VersionsPage";
import PremiumPage from "./pages/PremiumPage";
import LoginPage from "./pages/LoginPage";

const themes = {
  white: { id: "white", label: "Белоснежная", accent: "#e7dfdf", accentDark: "#d3cdcd"},
  sky: { id: "sky", label: "Небесная", accent: "#8aa8ca", accentDark: "#76b6ff" },
  mint: { id: "mint", label: "Мята", accent: "#34D399", accentDark: "#10B981" },
  banana: { id: "banana", label: "Банановая", accent: "#FACC15", accentDark: "#EAB308" },
  grape: { id: "grape", label: "Виноград", accent: "#8B5CF6", accentDark: "#7C3AED" },
  melon: { id: "melon", label: "Арбуз", accent: "#fc6969", accentDark: "#cc5c5c"},
  lavanda: { id: "lavanda", label: "Лаванда", accent: "#b57edc", accentDark: "#986bb8"},
  cool: { id: "cool", label: "Уголь", accent: "#36454f", accentDark: "#36454f"},
  nefrit: { id: "nefrit", label: "Нефрит", accent: "#00a86b", accentDark: "#048f5c"},
  biruza: { id: "biruza", label: "Бирюза", accent: "#30d5c8", accentDark: "#29bbaf"},
  persik: { id: "persik", label: "Персик", accent: "#ffdab9", accentDark: "#dab99d"},
};

const pages = {
  dashboard: DashboardPage,
  settings: SettingsPage,
  versions: VersionsPage,
  premium: PremiumPage
};

const builtInClients = [
  {
    id: 1,
    name: "SailenDLC",
    type: "Java",
    status: "Стабильная",
    title: "SailenDLC",
    description: "Высокая производительность, плавная работа, эксклюзивный дизайн, регулярные обновления и внимание к каждой детали. Всё создано для максимально комфортной игры.",
    folder: "SailenDLC",
    exePath: "SailenDLC.jar"
  },
  {
    id: 2,
    name: "SailenDLC Premium",
    type: "Java",
    status: "Premium",
    title: "SailenDLC Premium",
    description: "Премиум версия с расширенными возможностями. Доступна только после активации ключа.",
    folder: "SailenDLC Premium",
    exePath: "SailenPremium.jar"
  }
];

const fallbackSettings = {
  ramGb: 6,
  gamePath: "C:\\DefaultPath",
  themeId: "sky",
  closeAfterLaunch: false
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [settings, setSettings] = useState(fallbackSettings);
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [versions, setVersions] = useState([]);
  const [selectedVersionName, setSelectedVersionName] = useState("");
  const [selectedInstalled, setSelectedInstalled] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [installProgress, setInstallProgress] = useState({
    phase: "", percent: 0, downloadedBytes: 0, totalBytes: 0, totalKnown: false
  });
  const [authActivated, setAuthActivated] = useState(false);

  const theme = themes[settings.themeId] || themes.sky;
  const ActivePage = pages[currentPage];
  const selectedVersion = versions.find((v) => v.name === selectedVersionName) || null;

  const themeVars = useMemo(
    () => ({
      "--accent": theme.accent,
      "--accent-dark": theme.accentDark,
      "--accent-soft": `${theme.accent}33`,
      "--accent-glow": `${theme.accent}88`
    }),
    [theme]
  );

  useEffect(() => {
    (async () => {
      const loaded = await window.launcherApi?.getSettings?.();
      if (loaded) {
        const { clientsJsonUrl: _, ...safe } = loaded;
        setSettings((prev) => ({ ...prev, ...safe }));
      }
    })();
    (async () => {
      if (window.launcherApi?.authStatus) {
        const status = await window.launcherApi.authStatus();
        if (status.activated) setAuthActivated(true);
      }
    })();
  }, []);

  useEffect(() => {
    const filtered = authActivated ? builtInClients : builtInClients.filter(v => v.id === 1);
    setVersions(filtered);
    if (filtered.length && !filtered.some((item) => item.name === selectedVersionName)) {
      setSelectedVersionName(filtered[0].name);
    }
  }, [selectedVersionName, authActivated]);

  useEffect(() => {
    if (!selectedVersion || !window.launcherApi?.isClientInstalled) {
      setSelectedInstalled(false);
      return;
    }
    let active = true;
    (async () => {
      try {
        const installed = await window.launcherApi.isClientInstalled(selectedVersion);
        if (active) setSelectedInstalled(Boolean(installed));
      } catch {
        if (active) setSelectedInstalled(false);
      }
    })();
    return () => { active = false; };
  }, [selectedVersion, settings.gamePath]);

  useEffect(() => {
    if (!window.launcherApi?.onInstallProgress) return;
    return window.launcherApi.onInstallProgress((payload) => {
      setInstallProgress({
        phase: payload?.phase || "",
        percent: Number(payload?.percent || 0),
        downloadedBytes: Number(payload?.downloadedBytes || 0),
        totalBytes: Number(payload?.totalBytes || 0),
        totalKnown: Boolean(payload?.totalKnown)
      });
    });
  }, []);

  if (!loggedIn) {
    return <LoginPage onLogin={() => setLoggedIn(true)} theme={theme} />;
  }

  const saveSettings = async (partial) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    if (window.launcherApi?.saveSettings) {
      await window.launcherApi.saveSettings(next);
    }
  };

  const handleInstallOrPlay = async () => {
    if (!selectedVersion || !window.launcherApi) return;
    setActionError("");
    setActionLoading(true);
    setInstallProgress({ phase: "", percent: 0, downloadedBytes: 0, totalBytes: 0, totalKnown: false });
    try {
      if (!selectedInstalled) {
        await window.launcherApi.installClient(selectedVersion);
        setSelectedInstalled(true);
      }
      await window.launcherApi.launchClient(selectedVersion);
    } catch (error) {
      setActionError(error?.message ? String(error.message) : "Ошибка действия");
    } finally {
      setActionLoading(false);
      setInstallProgress({ phase: "", percent: 0, downloadedBytes: 0, totalBytes: 0, totalKnown: false });
    }
  };

  const handlePickFolder = async () => {
    if (!window.launcherApi?.pickFolder) return;
    const selectedPath = await window.launcherApi.pickFolder();
    if (selectedPath) {
      await saveSettings({ gamePath: selectedPath });
    }
  };

  const handleExitApp = () => {
    if (window.launcherWindow?.close) {
      window.launcherWindow.close();
      return;
    }
    window.close();
  };

  return (
    <div className="min-h-screen p-0" style={themeVars}>
      <div className="mx-auto flex h-screen w-full overflow-hidden rounded-[16px] border border-white/10 bg-[#090B16]">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onExit={handleExitApp} />
        <main className="relative flex-1 overflow-hidden">
          <div key={currentPage} className="page-transition h-full">
            <ActivePage
              selectedVersion={selectedVersionName || "—"}
              selectedVersionData={selectedVersion}
              versions={versions}
              versionsLoading={false}
              versionsError=""
              onSelectVersion={(name) => {
                setSelectedVersionName(name);
                setCurrentPage("dashboard");
              }}
              isInstalled={selectedInstalled}
              actionLoading={actionLoading}
              actionError={actionError}
              installProgress={installProgress}
              onInstallOrPlay={handleInstallOrPlay}
              settings={settings}
              themes={Object.values(themes)}
              onSettingsChange={saveSettings}
              onPickFolder={handlePickFolder}
              authActivated={authActivated}
              onAuthActivated={() => setAuthActivated(true)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
