import { useState } from "react";
import {
  Power,
  Download,
  Clock,
  BatteryWarning,
  RefreshCw,
  LogOut,
  Sparkles,
  Bot,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { SettingRow } from "./SettingRow";
import { Dropdown } from "./Dropdown";

const DEFAULT_GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

const MODEL_OPTIONS = [
  { value: "gemini-3.5-flash", label: "Gemini 3.5 Flash (Recommended)" },
  { value: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite (Fast)" },
  { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  { value: "gemini-pro-latest", label: "Gemini Pro Latest" },
];

interface GeneralTabProps {
  autostart: boolean;
  toggleAutostart: () => void;
  timeFormat24h: boolean;
  toggleTimeFormat24h: () => void;
  showUpdateIndicator: boolean;
  toggleUpdateIndicator: () => void;
  lowBatteryThreshold: number;
  handleThresholdChange: (val: number) => void;
  restartNectar: () => void;
  quitNectar: () => void;
}

export function GeneralTab({
  autostart,
  toggleAutostart,
  timeFormat24h,
  toggleTimeFormat24h,
  showUpdateIndicator,
  toggleUpdateIndicator,
  lowBatteryThreshold,
  handleThresholdChange,
  restartNectar,
  quitNectar,
}: GeneralTabProps) {
  const [geminiKey, setGeminiKey] = useState(
    () => localStorage.getItem("nook-gemini-api-key") ?? DEFAULT_GEMINI_KEY
  );
  const [geminiModel, setGeminiModel] = useState(
    () => localStorage.getItem("nook-gemini-model") ?? DEFAULT_GEMINI_MODEL
  );
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMsg, setTestMsg] = useState("");

  const handleKeyChange = (val: string) => {
    setGeminiKey(val);
    localStorage.setItem("nook-gemini-api-key", val);
    invoke("save_setting", { key: "nook-gemini-api-key", value: val }).catch(() => {});
    setTestStatus("idle");
  };

  const handleModelChange = (val: string) => {
    setGeminiModel(val);
    localStorage.setItem("nook-gemini-model", val);
    invoke("save_setting", { key: "nook-gemini-model", value: val }).catch(() => {});
  };

  const handleTestKey = async () => {
    const keyToTest = geminiKey.trim() || DEFAULT_GEMINI_KEY;
    setTestStatus("testing");
    setTestMsg("");
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${keyToTest}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: "Ping" }] }] }),
        }
      );
      if (res.ok) {
        setTestStatus("success");
        setTestMsg("API key verified and operational!");
        setTimeout(() => setTestStatus("idle"), 4000);
      } else {
        const data = await res.json().catch(() => ({}));
        setTestStatus("error");
        setTestMsg(data?.error?.message || "Invalid or unauthorized key");
      }
    } catch (e: any) {
      setTestStatus("error");
      setTestMsg(e?.message || "Network request failed");
    }
  };

  return (
    <>
      <div className="setting-group-label">System</div>
      <div className="setting-group">
        <SettingRow icon={Power} label="Launch at Login" desc="Open Nook automatically">
          <label className="toggle-switch">
            <input type="checkbox" checked={autostart} onChange={toggleAutostart} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow icon={Download} label="Update Indicator" desc="Show green dot when update available">
          <label className="toggle-switch">
            <input type="checkbox" checked={showUpdateIndicator} onChange={toggleUpdateIndicator} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow icon={Clock} label="24-Hour Time" desc="Use 24-hour clock format">
          <label className="toggle-switch">
            <input type="checkbox" checked={timeFormat24h} onChange={toggleTimeFormat24h} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow
          icon={BatteryWarning}
          label="Low Battery Alert"
          desc={`Trigger at ${lowBatteryThreshold}%`}
          divider={false}
        >
          <input
            type="range"
            min="5"
            max="50"
            step="5"
            value={lowBatteryThreshold}
            onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
            className="settings-slider"
          />
        </SettingRow>
      </div>

      <div className="setting-group-label">Artificial Intelligence (Gemini)</div>
      <div className="setting-group">
        <SettingRow
          icon={Sparkles}
          label="Gemini API Key"
          desc="Power AI search, calculations, and answers in Spotlight"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <input
                type={showKey ? "text" : "password"}
                value={geminiKey}
                onChange={(e) => handleKeyChange(e.target.value)}
                placeholder="Paste Gemini API Key"
                spellCheck={false}
                style={{
                  background: "rgba(255, 255, 255, 0.07)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "7px",
                  color: "#ffffff",
                  padding: "5px 28px 5px 8px",
                  fontSize: "11px",
                  width: "190px",
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey((s) => !s)}
                style={{
                  position: "absolute",
                  right: "4px",
                  background: "transparent",
                  border: "none",
                  color: "rgba(255, 255, 255, 0.5)",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
                title={showKey ? "Hide API key" : "Show API key"}
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            <button
              type="button"
              onClick={handleTestKey}
              disabled={testStatus === "testing"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                background:
                  testStatus === "success"
                    ? "rgba(74, 222, 128, 0.2)"
                    : testStatus === "error"
                    ? "rgba(239, 68, 68, 0.2)"
                    : "rgba(255, 255, 255, 0.1)",
                border:
                  "1px solid " +
                  (testStatus === "success"
                    ? "#4ade80"
                    : testStatus === "error"
                    ? "#ef4444"
                    : "rgba(255, 255, 255, 0.16)"),
                color:
                  testStatus === "success"
                    ? "#4ade80"
                    : testStatus === "error"
                    ? "#ef4444"
                    : "#ffffff",
                padding: "5px 10px",
                borderRadius: "7px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: testStatus === "testing" ? "wait" : "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {testStatus === "testing" ? (
                "Testing…"
              ) : testStatus === "success" ? (
                <>
                  <Check size={12} />
                  Connected
                </>
              ) : testStatus === "error" ? (
                <>
                  <AlertCircle size={12} />
                  Error
                </>
              ) : (
                "Test Key"
              )}
            </button>
          </div>
        </SettingRow>

        <SettingRow
          icon={Bot}
          label="AI Model"
          desc="Select the Gemini model for Spotlight responses"
          divider={testMsg !== ""}
        >
          <Dropdown
            value={geminiModel}
            options={MODEL_OPTIONS}
            onChange={handleModelChange}
          />
        </SettingRow>

        {testMsg && (
          <div
            style={{
              padding: "6px 14px 10px",
              fontSize: "11px",
              color: testStatus === "error" ? "#f87171" : "#4ade80",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {testStatus === "error" ? <AlertCircle size={13} /> : <Check size={13} />}
            <span>{testMsg}</span>
          </div>
        )}
      </div>

      <div className="setting-group-label">App</div>
      <div className="setting-group">
        <SettingRow icon={RefreshCw} label="Restart Nook" desc="Reinitialize all components" action onClick={restartNectar} />
        <SettingRow icon={LogOut} label="Quit Nook" desc="Exit application completely" action danger onClick={quitNectar} divider={false} />
      </div>
    </>
  );
}
