import { StrictMode, useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Effect, EffectState } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Settings, Palette, PanelTop, Monitor, Layers, Info } from "lucide-react";
import { WindowControls } from "./components/WindowControls";
import {
  useSettings,
  GeneralTab,
  AppearanceTab,
  NotchTab,
  CalendarSyncPage,
  DockTab,
  OverlaysTab,
  AboutTab,
} from "./settings/index";
import type { SettingsTab } from "./settings/index";
import { FeaturePreview } from "./settings/FeaturePreview";
import { initTheme } from "./theme";
import "./Settings.css";

const appWindow = getCurrentWebviewWindow();

const TABS: { id: SettingsTab; label: string; icon: typeof Settings }[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notch", label: "Notch", icon: PanelTop },
  { id: "dock", label: "Dock", icon: Monitor },
  { id: "overlays", label: "Overlays", icon: Layers },
  { id: "about", label: "About", icon: Info },
];

const TAB_COPY: Record<string, string> = {
  general: "The essentials for how Nook starts and runs.",
  appearance: "Make every surface feel at home on your desktop.",
  notch: "Choose what appears at the top of your screen.",
  dock: "Shape the taskbar replacement around your workflow.",
  overlays: "Keep quick controls visible only when you need them.",
  about: "Version, updates and your settings data.",
  "calendar-sync": "Configure CalDAV and ICS calendar synchronization.",
};

function SettingsApp() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [previewFocus, setPreviewFocus] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const settings = useSettings();

  useEffect(() => {
    return initTheme();
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("settings-navigate", (e) => {
      if (e.payload === "calendar-sync") setActiveTab("calendar-sync");
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const preventContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", preventContext as any);

    appWindow.setEffects({ effects: [Effect.Acrylic], state: EffectState.Active, color: [10, 10, 15, 20] }).catch(() => {});

    return () => {
      document.removeEventListener("contextmenu", preventContext as any);
    };
  }, []);

  useEffect(() => {
    invoke("resize_settings_window", {
      width: 740 * settings.scale,
      height: 560 * settings.scale,
    }).catch(console.error);
  }, [settings.scale]);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [activeTab]);

  return (
    <div className="settings-container" style={{ zoom: settings.scale }}>
      <div className="title-bar" data-tauri-drag-region>
        <span className="title-text" data-tauri-drag-region>
          Settings
        </span>
        <WindowControls />
      </div>

      <div className="settings-body">
        <div className="settings-sidebar">
          <div className="settings-sidebar-intro"><strong>Nook</strong><span>Make it yours</span></div>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`sidebar-tab ${activeTab === id || (id === "notch" && activeTab === "calendar-sync") ? "active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <div className="sidebar-tab-icon">
                <Icon size={14} strokeWidth={1.5} />
              </div>
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div
          className="settings-content"
          ref={contentRef}
          onChangeCapture={(event) => {
            const target = event.target as HTMLElement;
            const row = target.closest(".setting-item");
            let label = row?.querySelector(".setting-label")?.textContent;
            if (!label && target.closest(".settings-disclosure-standalone")) label = "Status Widgets";
            if (activeTab === "overlays" && label === "Show on Edge Hover") {
              const edgeRows = Array.from(contentRef.current?.querySelectorAll(".setting-item") ?? []).filter(
                (item) => item.querySelector(".setting-label")?.textContent === label
              );
              label = row === edgeRows[edgeRows.length - 1] && edgeRows.length > 1 ? "Brightness Edge Hover" : "Volume Edge Hover";
            }
            if (label) setPreviewFocus(activeTab + ":" + label + ":" + Date.now());
          }}
          onClickCapture={(event) => {
            const label = (event.target as HTMLElement).closest(".setting-item")?.querySelector(".setting-label")?.textContent;
            if (label === "Start Menu Icon" || label === "Weather Status") {
              setPreviewFocus(activeTab + ":" + label + ":" + Date.now());
            }
          }}
        >
          <div className="settings-page-heading">
            <h1>{TABS.find((tab) => tab.id === activeTab)?.label || "Calendar Sync"}</h1>
            <p>{TAB_COPY[activeTab] || ""}</p>
          </div>
          {activeTab !== "calendar-sync" && (
            <FeaturePreview
              tab={activeTab}
              settings={settings}
              focus={previewFocus}
            />
          )}
          {activeTab === "general" && (
            <GeneralTab
              autostart={settings.autostart}
              toggleAutostart={settings.toggleAutostart}
              timeFormat24h={settings.timeFormat24h}
              toggleTimeFormat24h={settings.toggleTimeFormat24h}
              showUpdateIndicator={settings.showUpdateIndicator}
              toggleUpdateIndicator={settings.toggleUpdateIndicator}
              lowBatteryThreshold={settings.lowBatteryThreshold}
              handleThresholdChange={settings.handleThresholdChange}
              restartNectar={settings.restartNectar}
              quitNectar={settings.quitNectar}
            />
          )}
          {activeTab === "appearance" && (
            <AppearanceTab
              themeMode={settings.themeMode}
              handleThemeModeChange={settings.handleThemeModeChange}
              themeColor={settings.themeColor}
              handleThemeColorChange={settings.handleThemeColorChange}
              themeOpacity={settings.themeOpacity}
              handleOpacityChange={settings.handleOpacityChange}
              themeSaturation={settings.themeSaturation}
              handleSaturationChange={settings.handleSaturationChange}
              themeBrightness={settings.themeBrightness}
              handleBrightnessChange={settings.handleBrightnessChange}
              cornersEnabled={settings.cornersEnabled}
              toggleCorners={settings.toggleCorners}
              scale={settings.scale}
              handleScaleChange={settings.handleScaleChange}
            />
          )}
          {activeTab === "calendar-sync" && <CalendarSyncPage onBack={() => setActiveTab("notch")} />}
          {activeTab === "notch" && (
            <NotchTab
              onOpenCalendarSync={() => setActiveTab("calendar-sync")}
              notchMode={settings.notchMode}
              setNotchModeValue={settings.setNotchModeValue}
              monitors={settings.monitors}
              notchMonitorMode={settings.notchMonitorMode}
              setNotchMonitorModeValue={settings.setNotchMonitorModeValue}
              notchMonitorId={settings.notchMonitorId}
              setNotchMonitorIdValue={settings.setNotchMonitorIdValue}
              notchModeByMonitor={settings.notchModeByMonitor}
              setNotchModeForMonitor={settings.setNotchModeForMonitor}
              replaceNotchModes={settings.replaceNotchModesByMonitor}
              calendarEnabled={settings.calendarEnabled}
              toggleCalendar={settings.toggleCalendar}
              timerEnabled={settings.timerEnabled}
              toggleTimerEnabled={settings.toggleTimerEnabled}
              timerSoundEnabled={settings.timerSoundEnabled}
              toggleTimerSound={settings.toggleTimerSound}
              stopwatchEnabled={settings.stopwatchEnabled}
              toggleStopwatchEnabled={settings.toggleStopwatchEnabled}
              musicModeEnabled={settings.musicModeEnabled}
              toggleMusicMode={settings.toggleMusicMode}
              musicCompactNotch={settings.musicCompactNotch}
              toggleMusicCompactNotch={settings.toggleMusicCompactNotch}
              mediaLayout={settings.mediaLayout}
              toggleMediaLayout={settings.toggleMediaLayout}
              mediaAmbienceEnabled={settings.mediaAmbienceEnabled}
              toggleAmbience={settings.toggleAmbience}
              mediaCompactGlowEnabled={settings.mediaCompactGlowEnabled}
              toggleCompactGlow={settings.toggleCompactGlow}
              weatherEnabled={settings.weatherEnabled}
              toggleWeather={settings.toggleWeather}
              tempUnitFahrenheit={settings.tempUnitFahrenheit}
              toggleTempUnit={settings.toggleTempUnit}
              cityName={settings.cityName}
              setCityName={settings.setCityName}
              citySearchResults={settings.citySearchResults}
              showCityDropdown={settings.showCityDropdown}
              setShowCityDropdown={settings.setShowCityDropdown}
              selectCity={settings.selectCity}
              handleCityClear={settings.handleCityClear}
              statusWidgets={settings.statusWidgets}
              handleWidgetsChange={settings.handleWidgetsChange}
              hasBattery={settings.hasBattery}
            />
          )}
          {activeTab === "dock" && (
            <DockTab
              dockEnabled={settings.dockEnabled}
              toggleDock={settings.toggleDock}
              dockMode={settings.dockMode}
              setDockModeValue={settings.setDockModeValue}
              dockPreviewEnabled={settings.dockPreviewEnabled}
              toggleDockPreview={settings.toggleDockPreview}
              dockSearchEnabled={settings.dockSearchEnabled}
              toggleDockSearch={settings.toggleDockSearch}
              dockCalendarEnabled={settings.dockCalendarEnabled}
              toggleDockCalendar={settings.toggleDockCalendar}
              dockIconOnly={settings.dockIconOnly}
              toggleDockIconOnly={settings.toggleDockIconOnly}
              dockAdaptive={settings.dockAdaptive}
              toggleDockAdaptive={settings.toggleDockAdaptive}
              startIcon={settings.startIcon}
              handleStartIconChange={settings.handleStartIconChange}
              dockWinNumberEnabled={settings.dockWinNumberEnabled}
              toggleDockWinNumber={settings.toggleDockWinNumber}
              dockMixedReorder={settings.dockMixedReorder}
              toggleDockMixedReorder={settings.toggleDockMixedReorder}
              monitors={settings.monitors}
              dockMonitorMode={settings.dockMonitorMode}
              setDockMonitorModeValue={settings.setDockMonitorModeValue}
              dockMonitorId={settings.dockMonitorId}
              setDockMonitorIdValue={settings.setDockMonitorIdValue}
              dockModeByMonitor={settings.dockModeByMonitor}
              setDockModeForMonitor={settings.setDockModeForMonitor}
              replaceDockModes={settings.replaceDockModesByMonitor}
            />
          )}
          {activeTab === "overlays" && (
            <OverlaysTab
              volumeOverlayEnabled={settings.volumeOverlayEnabled}
              toggleVolumeOverlay={settings.toggleVolumeOverlay}
              volumeEdgeEnabled={settings.volumeEdgeEnabled}
              toggleVolumeEdge={settings.toggleVolumeEdge}
              brightnessOverlayEnabled={settings.brightnessOverlayEnabled}
              toggleBrightnessOverlay={settings.toggleBrightnessOverlay}
              brightnessEdgeEnabled={settings.brightnessEdgeEnabled}
              toggleBrightnessEdge={settings.toggleBrightnessEdge}
            />
          )}
          {activeTab === "about" && (
            <AboutTab
              appVersion={settings.appVersion}
              autoUpdate={settings.autoUpdate}
              toggleAutoUpdate={settings.toggleAutoUpdate}
              updateStatus={settings.updateStatus}
              updateVersion={settings.updateVersion}
              checkForUpdates={settings.checkForUpdates}
              installUpdate={settings.installUpdate}
              exportStatus={settings.exportStatus}
              importStatus={settings.importStatus}
              handleExportSettings={settings.handleExportSettings}
              handleImportSettings={settings.handleImportSettings}
              resetStatus={settings.resetStatus}
              handleResetSettings={settings.handleResetSettings}
              uninstallStatus={settings.uninstallStatus}
              uninstallError={settings.uninstallError}
              handleUninstallNectar={settings.handleUninstallNectar}
            />
          )}
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <SettingsApp />
  </StrictMode>
);
