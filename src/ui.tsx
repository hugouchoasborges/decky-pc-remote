// Small UI building blocks, after MAKO's panel style: status card, notices,
// collapsible sections remembered per section, and buttons with a busy spinner.
import { ButtonItem, PanelSection, PanelSectionRow, Spinner } from "@decky/ui";
import { CSSProperties, ReactNode, useState } from "react";
import { FiAlertCircle, FiCheckCircle, FiInfo, FiXCircle } from "react-icons/fi";
import { RiArrowDownSFill, RiArrowUpSFill } from "react-icons/ri";

export const accent = "#83bff0";
const ok = "#65b9c9";
const warn = "#c89558";
const bad = "#d9706a";
const divider = "1px solid rgba(77, 170, 190, 0.2)";

const card: CSSProperties = {
  border: divider,
  borderRadius: "6px",
  background: "rgba(16, 32, 40, 0.55)",
  padding: "8px 10px",
  boxSizing: "border-box",
  width: "100%",
};

export type CardState = "online" | "offline" | "connecting";

export function StatusCard({ state, title, lines }: { state: CardState; title: string; lines: [string, ReactNode][] }) {
  const color = state === "online" ? ok : state === "offline" ? bad : warn;
  const Icon = state === "online" ? FiCheckCircle : state === "offline" ? FiXCircle : FiAlertCircle;
  const label = state === "online" ? "Online" : state === "offline" ? "Offline" : "Connecting…";
  return (
    <PanelSectionRow>
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, fontSize: "14px", color: "#e6f2f5" }}>
          {state === "connecting" ? <Spinner style={{ width: "16px", height: "16px" }} /> : <Icon style={{ width: "16px", height: "16px", color }} />}
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</span>
          <span style={{ fontSize: "12px", color }}>{label}</span>
        </div>
        {lines.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "5px", paddingTop: "5px", borderTop: divider, color: "#b8c8cc" }}>
            <span>{k}</span>
            <span style={{ color: "#e6f2f5" }}>{v}</span>
          </div>
        ))}
      </div>
    </PanelSectionRow>
  );
}

export function Notice({ kind, children, action }: { kind: "info" | "error"; children: ReactNode; action?: ReactNode }) {
  const color = kind === "error" ? bad : accent;
  const Icon = kind === "error" ? FiXCircle : FiInfo;
  return (
    <PanelSectionRow>
      <div style={{ ...card, borderColor: color, display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "12px", color: "#e6f2f5" }}>
        <Icon style={{ width: "15px", height: "15px", flex: "0 0 15px", color, marginTop: "1px" }} />
        <span style={{ flex: 1 }}>{children}</span>
      </div>
      {action}
    </PanelSectionRow>
  );
}

const readCollapsed = (key: string, initial: boolean) => {
  try {
    const v = localStorage.getItem(`pc-remote:collapsed:${key}`);
    return v === null ? initial : v === "1";
  } catch { return initial; }
};

// A thin arrow bar instead of a full-height button (MAKO's CollapseControl idea).
const collapseCss = `
.pcr-collapse .DialogButton { min-height: 0 !important; height: 18px !important; padding: 0 !important;
  display: flex !important; align-items: center; justify-content: center; font-size: 1.4em; line-height: 1; }
.pcr-collapse > div, .pcr-collapse .Panel { padding-top: 0 !important; padding-bottom: 0 !important; }
`;

/** A PanelSection whose body hides behind an arrow, remembered across openings. */
export function Section({ id, title, initiallyCollapsed = false, children }: { id: string; title: string; initiallyCollapsed?: boolean; children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => readCollapsed(id, initiallyCollapsed));
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(`pc-remote:collapsed:${id}`, next ? "1" : "0"); } catch { /* per-viewer nicety only */ }
  };
  return (
    <PanelSection title={title}>
      {!collapsed && children}
      <PanelSectionRow>
        <style>{collapseCss}</style>
        <div className="pcr-collapse">
          <ButtonItem layout="below" bottomSeparator="none" onClick={toggle}>
            {collapsed ? <RiArrowDownSFill /> : <RiArrowUpSFill />}
          </ButtonItem>
        </div>
      </PanelSectionRow>
    </PanelSection>
  );
}

/** A ButtonItem that shows a spinner while its async action runs and ignores presses meanwhile. */
export function BusyButton({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => Promise<unknown> | void }) {
  const [busy, setBusy] = useState(false);
  return (
    <PanelSectionRow>
      <ButtonItem layout="below" disabled={disabled || busy} onClick={async () => {
        if (busy) return;
        setBusy(true);
        try { await onClick(); } finally { setBusy(false); }
      }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          {busy && <Spinner style={{ width: "14px", height: "14px" }} />}
          {label}
        </span>
      </ButtonItem>
    </PanelSectionRow>
  );
}
