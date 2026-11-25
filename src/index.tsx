import {
  ConfirmModal,
  DialogBody,
  DialogButton,
  DialogFooter,
  DialogHeader,
  Dropdown,
  DropdownItem,
  Field,
  Focusable,
  ModalRoot,
  PanelSection,
  PanelSectionRow,
  Navigation,
  SliderField,
  TextField,
  ToggleField,
  showModal,
  staticClasses,
  useQuickAccessVisible,
} from "@decky/ui";
import { callable, definePlugin, toaster } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { FaDesktop } from "react-icons/fa";
import { FaSteam } from "react-icons/fa";
import { FiClock, FiEdit2, FiEyeOff, FiHeadphones, FiSpeaker, FiKey, FiLogOut, FiMonitor, FiMoon, FiPlay, FiPlus, FiPower, FiRotateCw, FiSettings, FiTrash2, FiVolume2, FiVolumeX, FiWifi } from "react-icons/fi";
import { MdOutlineTv } from "react-icons/md";
import { CardState, Meter, CollapsibleSection, GameRow, Notice, PanelStyles, Section, StatusCard, TileRow, WideTile } from "./ui";

type Pc = { name: string; host: string; port: number; token: string; hidden?: number[] }; // hidden: app ids left off the panel
type Config = { pcs: Pc[]; selected: number };
type Status = { host?: string; steam?: boolean; volume?: number; muted?: boolean; error?: string; moved_to?: string };

const getConfig = callable<[], Config>("get_config");
const savePc = callable<[number, Pc], Config>("save_pc");
const removePc = callable<[number], Config>("remove_pc");
const selectPc = callable<[number], Config>("select_pc");
const getStatus = callable<[], Status>("status");
const command = callable<[string], Status & { ok?: boolean }>("command");
const setVolume = callable<[number], Status>("set_volume");
type Game = { appid: number; name: string; lastPlayed: number; nonSteam?: boolean };
type Games = { games: Game[]; running: number; error?: string };
const getGames = callable<[], Games>("games");
type Stats = { cpu?: number; cpuName?: string; ramUsed?: number; ramTotal?: number; gpus?: { name: string; use: number | null }[]; uptime?: number; game?: string | null; error?: string };
const getStats = callable<[], Stats>("stats");
type AudioDevice = { id: string; name: string; kind: number };
type Audio = { default?: string; devices?: AudioDevice[]; error?: string };
const getAudio = callable<[], Audio>("audio");
const setAudio = callable<[string], Audio>("set_audio");

const gb = (b: number) => (b / 1024 ** 3).toFixed(1);
const since = (s: number) => {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
};
// Endpoint form factor -> icon: 3 headphones, 5 headset, 9 HDMI / DisplayPort, else speakers.
const outputIcon = (kind?: number) => kind === 3 || kind === 5 ? FiHeadphones : kind === 9 ? MdOutlineTv : FiSpeaker;

// Opens the game's own page in the Deck's library, where Steam offers Stream / Play.
const openGame = (appid: number) => { Navigation.CloseSideMenus(); Navigation.Navigate(`/library/app/${appid}`); };

const EMPTY: Pc = { name: "", host: "", port: 47990, token: "" };

const discover = callable<[], { name: string; host: string; port: number }[]>("discover");

// The PC form opens as a modal in the main window (like MAKO's text inputs): the on-screen
// keyboard does not type into text fields inside the Quick Access Menu.
function PcEditModal({ initial, games, onSave, closeModal }: { initial: Pc; games?: Game[]; onSave: (pc: Pc) => void; closeModal?: () => void }) {
  const [hidden, setHidden] = useState<number[]>(initial.hidden ?? []);
  const [name, setName] = useState(initial.name);
  const [host, setHost] = useState(initial.host);
  const [port, setPort] = useState(String(initial.port || 47990));
  const [token, setToken] = useState(initial.token);
  const [found, setFound] = useState<string>("");
  const search = async () => {
    setFound("Searching…");
    const list = await discover();
    if (!list.length) { setFound("No PC found (is the agent running and the firewall open?)"); return; }
    const pick = list.find((d) => d.name.toLowerCase() === name.trim().toLowerCase()) ?? list[0];
    setName(pick.name); setHost(pick.host); setPort(String(pick.port));
    setFound(`Found: ${list.map((d) => `${d.name} (${d.host})`).join(", ")}`);
  };
  const valid = host.trim() && token.trim();
  return (
    <ModalRoot onCancel={closeModal}>
      <DialogHeader>{initial.host ? "Edit PC" : "Add a PC"}</DialogHeader>
      <DialogBody>
        <Field label="Name" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={name} onChange={(e) => setName(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        <Field label="PC's IP or name" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={host} onChange={(e) => setHost(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        <Field label="Port" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={port} onChange={(e) => setPort(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        <Field label="Token" description="Shown by install.ps1 on the PC" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={token} onChange={(e) => setToken(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        {found && <Field label={found} />}
        {games && games.length > 0 && (
          <>
            <Field label="Shown on the panel" description="Turn off the games and apps you don't want in Games on the PC." />
            {games.map((g) => (
              <ToggleField key={g.appid} label={g.name} description={g.nonSteam ? "Non-Steam" : undefined}
                checked={!hidden.includes(g.appid)}
                onChange={(on) => setHidden((h) => on ? h.filter((id) => id !== g.appid) : [...h, g.appid])} />
            ))}
          </>
        )}
      </DialogBody>
      <DialogFooter>
        <Focusable style={{ display: "flex", gap: "8px" }} flow-children="row">
          <DialogButton onClick={search}>Search the network</DialogButton>
          <DialogButton onClick={closeModal}>Cancel</DialogButton>
          <DialogButton disabled={!valid} onClick={() => {
            onSave({ name: name.trim() || host.trim(), host: host.trim(), port: Number(port) || 47990, token: token.trim(), hidden });
            closeModal?.();
          }}>Save</DialogButton>
        </Focusable>
      </DialogFooter>
    </ModalRoot>
  );
}

function Content() {
  const [config, setConfig] = useState<Config>({ pcs: [], selected: 0 });
  const [status, setStatus] = useState<Status>({});
  const volTimer = useRef<number>();

  const [notice, setNotice] = useState<string>("");
  const [games, setGames] = useState<Games | null>(null);
  const loadGames = async () => {
    const r = await getGames();
    setGames(r.error ? { games: [], running: 0, error: r.error } : r);
  };
  const apply = (r: Status) => {
    setStatus(r);
    if (r.moved_to) setNotice(`The PC's IP changed: found again at ${r.moved_to}`);
  };
  const refresh = async () => apply(await getStatus());
  const [stats, setStats] = useState<Stats>({});
  const [audio, setAudioState] = useState<Audio>({});
  const loadStats = async () => setStats(await getStats());
  const loadAudio = async () => setAudioState(await getAudio());
  // Everything live is fetched only while the panel is on screen: the PC measures on request.
  const visible = useQuickAccessVisible();
  useEffect(() => { getConfig().then(setConfig); }, []);
  useEffect(() => {
    if (!visible || !config.pcs.length) return;
    refresh(); loadStats(); loadAudio();
    const t = window.setInterval(refresh, 3000);
    const st = window.setInterval(loadStats, 2000);
    return () => { window.clearInterval(t); window.clearInterval(st); };
  }, [visible, config.selected, config.pcs.length]);

  const run = async (path: string, done: string) => {
    const r = await command(path);
    toaster.toast({ title: "PC Remote", body: r.error ?? done });
    if (r.moved_to) apply(r);
    setTimeout(refresh, 1500);
  };
  // The modal opens in the main window: close the Quick Access Menu first so it is not hidden behind it.
  const confirm = (title: string, path: string, done: string) => {
    Navigation.CloseSideMenus();
    showModal(<ConfirmModal strTitle={title} strDescription="Are you sure?" strOKButtonText="Yes" strCancelButtonText="No" onOK={() => run(path, done)} />);
  };

  const onVolume = (v: number) => {
    setStatus((s) => ({ ...s, volume: v }));
    window.clearTimeout(volTimer.current);
    volTimer.current = window.setTimeout(async () => apply(await setVolume(v)), 200);
  };

  const edit = async (index: number) => {
    // The games list only exists for the PC being shown, so only its form offers to hide games.
    let list: Game[] | undefined;
    if (index === config.selected && index >= 0) {
      const g = games && !games.error ? games : await getGames();
      if (!g.error) { setGames(g); list = g.games; }
    }
    Navigation.CloseSideMenus();
    showModal(<PcEditModal initial={index < 0 ? EMPTY : config.pcs[index]} games={list}
      onSave={async (pc) => { setConfig(await savePc(index, pc)); setStatus({}); refresh(); loadStats(); loadAudio(); }} />);
  };

  const pc = config.pcs[config.selected];
  const online = !status.error && status.host !== undefined;
  const state: CardState = online ? "online" : status.error ? "offline" : "connecting";
  const badToken = status.error === "Invalid token";

  if (!pc) {
    return (
      <PanelSection>
        <PanelStyles />
        <Notice kind="info">No PC yet. Install the agent on the PC (agent\install.ps1), then add it here: Search the network fills in its name and address.</Notice>
        <WideTile icon={FiPlus} label="Add a PC" t="steam" onClick={() => edit(-1)} />
      </PanelSection>
    );
  }

  const hiddenIds = pc.hidden ?? [];
  const shown = games && !games.error ? games.games.filter((g) => !hiddenIds.includes(g.appid)) : [];
  const hiddenCount = games && !games.error ? games.games.length - shown.length : 0;
  const volumeText = online ? (status.muted ? "Muted" : `${status.volume}%`) : "—";
  return (
    <>
      <PanelSection>
        <PanelStyles />
        {config.pcs.length > 1 && (
          <PanelSectionRow>
            <Dropdown
              rgOptions={config.pcs.map((p, i) => ({ data: i, label: p.name }))}
              selectedOption={config.selected}
              onChange={async (o) => { setConfig(await selectPc(o.data)); setStatus({}); setStats({}); setAudioState({}); setNotice(""); }}
            />
          </PanelSectionRow>
        )}
        <StatusCard state={state} title={pc.name} lines={[
          [FiWifi, "Address", `${pc.host}:${pc.port || 47990}`],
          [FaSteam, "Steam", online ? (status.steam ? "Open" : "Closed") : "—"],
          [status.muted ? FiVolumeX : FiVolume2, "Volume", volumeText],
          ...(online && stats.game ? [[FiPlay, "Playing", stats.game] as [typeof FiPlay, string, string]] : []),
          ...(online && stats.uptime != null ? [[FiClock, "On for", since(stats.uptime)] as [typeof FiClock, string, string]] : []),
        ]} meters={online && stats.cpu != null ? [
          { label: stats.cpuName || "CPU", text: `${stats.cpu}%`, pct: stats.cpu },
          { label: "RAM", text: `${gb(stats.ramUsed!)}/${gb(stats.ramTotal!)} GB`, pct: (100 * stats.ramUsed!) / stats.ramTotal! },
          // One meter per GPU Windows has running: the dedicated one disappears when the MUX turns it off.
          ...(stats.gpus ?? []).map((g) => ({ label: g.name, text: g.use == null ? "…" : `${g.use}%`, pct: g.use })),
        ] as Meter[] : undefined} />
        {badToken && <Notice kind="error">The PC refused the token. Check the token install.ps1 showed.</Notice>}
        {badToken && <WideTile icon={FiKey} label="Fix token" t="danger" onClick={() => edit(config.selected)} />}
        {state === "offline" && !badToken && (
          <Notice kind="error">No answer. Is the PC on, on the same network, with the agent running?</Notice>
        )}
        {notice && <Notice kind="info">{notice}</Notice>}
      </PanelSection>

      <CollapsibleSection id="games" title="Games on the PC" icon={FiPlay} t="ok" initiallyCollapsed onExpand={loadGames}
        summary={games && !games.error ? `${shown.length} shown${hiddenCount ? `, ${hiddenCount} hidden` : ""}` : undefined}>
        {!games && <Notice kind="info">Loading the PC's library…</Notice>}
        {games?.error && <Notice kind="error">{games.error}</Notice>}
        {games && !games.error && shown.length === 0 && (
          <Notice kind="info">{hiddenCount ? "Every game is hidden: show some again in PCs → Edit." : "No installed games found on this PC."}</Notice>
        )}
        {games && !games.error && games.games.length > 0 && online && !status.steam && (
          <>
            <Notice kind="info">Steam is closed on the PC: open it to stream these games.</Notice>
            <WideTile icon={FaSteam} label="Open Steam" t="steam" onClick={() => run("/steam/open", "Opening Steam")} />
          </>
        )}
        {shown.map((g) => (
          <GameRow key={g.appid} appid={g.appid} name={g.name} nonSteam={g.nonSteam} playing={g.appid === games!.running}
            onClick={() => g.nonSteam && !status.steam
              // The Deck only knows the PC's non-Steam games while Steam runs there.
              ? toaster.toast({ title: "PC Remote", body: "Open Steam on the PC first: non-Steam games show up on the Deck only while it runs." })
              : openGame(g.appid)} />
        ))}
      </CollapsibleSection>

      <Section title="Steam" icon={FaSteam} t="steam">
        {status.steam
          ? <WideTile icon={FiLogOut} label="Close Steam" t="steam" disabled={!online} onClick={() => run("/steam/close", "Closing Steam")} />
          : <WideTile icon={FaSteam} label="Open Steam" t="steam" disabled={!online} onClick={() => run("/steam/open", "Opening Steam")} />}
      </Section>

      <Section title="Volume" icon={status.muted ? FiVolumeX : FiVolume2} t="sound">
        <PanelSectionRow>
          <SliderField label="Volume" value={status.volume ?? 0} min={0} max={100} step={2} showValue disabled={!online} onChange={onVolume} />
        </PanelSectionRow>
        <WideTile icon={status.muted ? FiVolume2 : FiVolumeX} label={status.muted ? "Unmute" : "Mute"} t="sound" disabled={!online}
          onClick={async () => apply(await command("/mute"))} />
        {online && audio.devices && audio.devices.length > 0 && (() => {
          const cur = audio.devices.find((d) => d.id === audio.default);
          const OutIcon = outputIcon(cur?.kind);
          return (
            <PanelSectionRow>
              <DropdownItem layout="below" childrenContainerWidth="max" label={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><OutIcon /> Output</span>}
                description={audio.devices.length === 1 ? "The only output Windows has active right now" : undefined}
                rgOptions={audio.devices.map((d) => ({ data: d.id, label: d.name }))}
                selectedOption={audio.default}
                onChange={async (o) => {
                  const r = await setAudio(o.data);
                  if (r.error) toaster.toast({ title: "PC Remote", body: r.error });
                  if (r.devices) setAudioState(r);
                  refresh();
                }} />
            </PanelSectionRow>
          );
        })()}
      </Section>

      <Section title="Screen" icon={FiMonitor} t="screen">
        <WideTile icon={FiEyeOff} label="Turn off the screen" t="screen" disabled={!online} onClick={() => run("/screen/off", "Screen off")} />
      </Section>

      <Section title="Power" icon={FiPower} t="danger" note="Asks to confirm">
        <TileRow tiles={[
          { icon: FiMoon, label: "Sleep", t: "caution", disabled: !online, onClick: () => confirm("Put the PC to sleep?", "/power/suspend", "Going to sleep") },
          { icon: FiRotateCw, label: "Restart", t: "caution", disabled: !online, onClick: () => confirm("Restart the PC?", "/power/restart", "Restarting") },
          { icon: FiPower, label: "Shut down", t: "danger", disabled: !online, onClick: () => confirm("Shut down the PC?", "/power/shutdown", "Shutting down") },
        ]} />
      </Section>

      <Section title="PCs" icon={FiSettings} t="neutral" note={`${config.pcs.length} saved`}>
        <TileRow tiles={[
          { icon: FiEdit2, label: "Edit", t: "neutral", onClick: () => edit(config.selected) },
          { icon: FiPlus, label: "Add", t: "steam", onClick: () => edit(-1) },
          { icon: FiTrash2, label: "Remove", t: "danger", onClick: () => {
            Navigation.CloseSideMenus();
            showModal(<ConfirmModal strTitle={`Remove ${pc.name}?`} strDescription="Its address and token are forgotten on this Deck."
              strOKButtonText="Remove" strCancelButtonText="Cancel"
              onOK={async () => { setConfig(await removePc(config.selected)); setStatus({}); refresh(); }} />);
          } },
        ]} />
      </Section>
    </>
  );
}

export default definePlugin(() => ({
  name: "PC Remote",
  titleView: <div className={staticClasses.Title}>PC Remote</div>,
  content: <Content />,
  icon: <FaDesktop />,
}));
