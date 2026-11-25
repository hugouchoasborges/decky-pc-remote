// PC Remote's panel vocabulary: a console-remote feel inside SteamOS.
// - Section headers are the collapse toggles (icon badge, title, summary, rotating chevron).
// - Actions are tiles: an icon with a short label, tinted by action family.
// - Colour carries state and action family only; every state also has an icon and words.
import { DialogButton, Focusable, PanelSection, PanelSectionRow, Spinner } from "@decky/ui";
import { CSSProperties, ReactNode, useState } from "react";
import { IconType } from "react-icons";
import { FiAlertCircle, FiCheckCircle, FiChevronDown, FiInfo, FiXCircle } from "react-icons/fi";

/** Action families. Steam blue is SteamOS's own accent. */
export const tone = {
  steam: "#1a9fff",
  screen: "#a78bfa",
  sound: "#3ccfcf",
  caution: "#e3a338",
  danger: "#f0605a",
  ok: "#4cc38a",
  neutral: "#8b98a5",
} as const;
export type Tone = keyof typeof tone;

const ink = "#e8eef2";
const inkMuted = "#a9b6bf";
const line = "rgba(255, 255, 255, 0.08)";

// Injected once by <PanelStyles/>. Steam marks the focused element with .gpfocus.
const css = `
.pcr-head.DialogButton { display: flex !important; align-items: center; gap: 10px; width: 100%;
  min-height: 40px !important; padding: 6px 8px !important; margin: 0 !important;
  background: transparent !important; border-radius: 6px; text-align: left; color: ${ink} !important; }
.pcr-head.DialogButton.gpfocus, .pcr-head.DialogButton:hover { background: rgba(255,255,255,0.08) !important; }
.pcr-head .pcr-chev { transition: transform 180ms cubic-bezier(0.25, 1, 0.5, 1); }
.pcr-head[aria-expanded="true"] .pcr-chev { transform: rotate(180deg); }

.pcr-tile.DialogButton { display: flex !important; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; min-width: 0 !important; width: 100%; min-height: 66px !important; padding: 10px 4px !important; margin: 0 !important;
  border-radius: 8px; border: 1px solid var(--pcr-c-line) !important; background: var(--pcr-c-bg) !important;
  color: ${ink} !important; font-size: 13px !important; font-weight: 600; line-height: 1.15; white-space: nowrap;
  transition: background 150ms ease-out, border-color 150ms ease-out, transform 120ms ease-out; }
.pcr-tile.DialogButton.gpfocus, .pcr-tile.DialogButton:hover { background: var(--pcr-c-bg-strong) !important;
  border-color: var(--pcr-c) !important; }
.pcr-tile.DialogButton:active { transform: scale(0.97); }
.pcr-tile.DialogButton svg { width: 22px; height: 22px; color: var(--pcr-c); flex: 0 0 auto; }
.pcr-tile.pcr-wide.DialogButton { flex-direction: row; justify-content: flex-start; gap: 12px; min-height: 50px !important;
  padding: 8px 14px !important; font-size: 15px !important; }

.pcr-row { display: grid; gap: 8px; width: 100%; padding: 4px 0; }
@media (prefers-reduced-motion: reduce) {
  .pcr-head .pcr-chev, .pcr-tile.DialogButton { transition: none; }
  .pcr-tile.DialogButton:active { transform: none; }
}
`;
export const PanelStyles = () => <style>{css}</style>;

const alpha = (hex: string, a: number) => hex + Math.round(a * 255).toString(16).padStart(2, "0");
const toneVars = (t: Tone) => ({
  "--pcr-c": tone[t],
  "--pcr-c-bg": alpha(tone[t], 0.1),
  "--pcr-c-bg-strong": alpha(tone[t], 0.26),
  "--pcr-c-line": alpha(tone[t], 0.3),
}) as CSSProperties;

function IconBadge({ icon: Icon, t, size = 28 }: { icon: IconType; t: Tone; size?: number }) {
  return (
    <span style={{
      width: size, height: size, flex: `0 0 ${size}px`, borderRadius: 7, display: "grid", placeItems: "center",
      background: alpha(tone[t], 0.18), color: tone[t],
    }}>
      <Icon style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}

// ---------------------------------------------------------------- status

export type CardState = "online" | "offline" | "connecting";

export function StatusCard({ state, title, lines }: { state: CardState; title: string; lines: [IconType, string, ReactNode][] }) {
  const t: Tone = state === "online" ? "ok" : state === "offline" ? "danger" : "caution";
  const Icon = state === "online" ? FiCheckCircle : state === "offline" ? FiXCircle : FiAlertCircle;
  const label = state === "online" ? "Online" : state === "offline" ? "Offline" : "Connecting…";
  return (
    <PanelSectionRow>
      <div style={{
        width: "100%", boxSizing: "border-box", borderRadius: 10, padding: "12px 12px 6px",
        background: alpha(tone[t], 0.1), border: `1px solid ${alpha(tone[t], 0.35)}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 10, height: 10, flex: "0 0 10px", borderRadius: "50%", background: tone[t], boxShadow: `0 0 8px ${tone[t]}` }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 700, color: ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 700, color: tone[t] }}>
            {state === "connecting" ? <Spinner style={{ width: 13, height: 13 }} /> : <Icon style={{ width: 13, height: 13 }} />}
            {label}
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          {lines.map(([LIcon, k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${line}`, fontSize: 12 }}>
              <LIcon style={{ width: 13, height: 13, color: inkMuted }} />
              <span style={{ color: inkMuted }}>{k}</span>
              <span style={{ marginLeft: "auto", color: ink, fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </PanelSectionRow>
  );
}

export function Notice({ kind, children }: { kind: "info" | "error"; children: ReactNode }) {
  const t: Tone = kind === "error" ? "danger" : "steam";
  const Icon = kind === "error" ? FiXCircle : FiInfo;
  return (
    <PanelSectionRow>
      <div style={{
        width: "100%", boxSizing: "border-box", display: "flex", gap: 8, alignItems: "flex-start",
        padding: "8px 10px", borderRadius: 8, fontSize: 12, lineHeight: 1.35, color: ink,
        background: alpha(tone[t], 0.12), border: `1px solid ${alpha(tone[t], 0.4)}`,
      }}>
        <Icon style={{ width: 15, height: 15, flex: "0 0 15px", color: tone[t], marginTop: 1 }} />
        <span>{children}</span>
      </div>
    </PanelSectionRow>
  );
}

// ---------------------------------------------------------------- sections

const readCollapsed = (key: string, initial: boolean) => {
  try {
    const v = localStorage.getItem(`pc-remote:collapsed:${key}`);
    return v === null ? initial : v === "1";
  } catch { return initial; }
};

/** A section whose header is its collapse toggle; the summary shows what is hidden. */
export function Section({ id, title, icon, t, summary, initiallyCollapsed = false, children }: {
  id: string; title: string; icon: IconType; t: Tone; summary?: ReactNode; initiallyCollapsed?: boolean; children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id, initiallyCollapsed));
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(`pc-remote:collapsed:${id}`, next ? "1" : "0"); } catch { /* a per-device nicety */ }
  };
  const showSummary = collapsed && summary !== undefined;
  return (
    <PanelSection>
      <PanelSectionRow>
        <DialogButton className="pcr-head" aria-expanded={!collapsed} onClick={toggle}>
          <IconBadge icon={icon} t={t} />
          <span style={{ fontSize: 14, fontWeight: 700 }}>{title}</span>
          {showSummary && <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: inkMuted }}>{summary}</span>}
          <FiChevronDown className="pcr-chev" style={{ marginLeft: showSummary ? 6 : "auto", width: 18, height: 18, color: inkMuted }} />
        </DialogButton>
      </PanelSectionRow>
      {!collapsed && children}
    </PanelSection>
  );
}

// ---------------------------------------------------------------- actions

export type TileProps = { icon: IconType; label: string; t: Tone; disabled?: boolean; onClick: () => Promise<unknown> | void };

function useBusy(onClick: TileProps["onClick"]) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try { await onClick(); } finally { setBusy(false); }
  };
  return [busy, run] as const;
}

/** A full-width action: icon on the left, label, spinner while it runs. */
export function WideTile({ icon: Icon, label, t, disabled, onClick }: TileProps) {
  const [busy, run] = useBusy(onClick);
  return (
    <PanelSectionRow>
      <DialogButton className="pcr-tile pcr-wide" style={toneVars(t)} disabled={disabled || busy} onClick={run}>
        {busy ? <Spinner style={{ width: 22, height: 22 }} /> : <Icon />}
        <span>{label}</span>
      </DialogButton>
    </PanelSectionRow>
  );
}

/** A row of square tiles, moved through with left/right on the D-pad. */
export function TileRow({ tiles }: { tiles: TileProps[] }) {
  return (
    <PanelSectionRow>
      <Focusable className="pcr-row" flow-children="horizontal" style={{ gridTemplateColumns: `repeat(${tiles.length}, 1fr)` }}>
        {tiles.map((tile) => <Tile key={tile.label} {...tile} />)}
      </Focusable>
    </PanelSectionRow>
  );
}

function Tile({ icon: Icon, label, t, disabled, onClick }: TileProps) {
  const [busy, run] = useBusy(onClick);
  return (
    <DialogButton className="pcr-tile" style={toneVars(t)} disabled={disabled || busy} onClick={run}>
      {busy ? <Spinner style={{ width: 22, height: 22 }} /> : <Icon />}
      <span>{label}</span>
    </DialogButton>
  );
}
