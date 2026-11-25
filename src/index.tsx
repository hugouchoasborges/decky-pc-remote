import {
  ConfirmModal,
  DialogBody,
  DialogButton,
  DialogFooter,
  DialogHeader,
  Dropdown,
  Field,
  Focusable,
  ModalRoot,
  PanelSection,
  PanelSectionRow,
  Navigation,
  SliderField,
  TextField,
  showModal,
  staticClasses,
} from "@decky/ui";
import { callable, definePlugin, toaster } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { FaDesktop } from "react-icons/fa";
import { FaSteam } from "react-icons/fa";
import { FiEdit2, FiEyeOff, FiKey, FiLogOut, FiMonitor, FiMoon, FiPlay, FiPlus, FiPower, FiRotateCw, FiSettings, FiTrash2, FiVolume2, FiVolumeX, FiWifi } from "react-icons/fi";
import { CardState, CollapsibleSection, GameRow, Notice, PanelStyles, Section, StatusCard, TileRow, WideTile } from "./ui";

type Pc = { name: string; host: string; port: number; token: string };
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

// Opens the game's own page in the Deck's library, where Steam offers Stream / Play.
const openGame = (appid: number) => { Navigation.CloseSideMenus(); Navigation.Navigate(`/library/app/${appid}`); };

const EMPTY: Pc = { name: "", host: "", port: 47990, token: "" };

const discover = callable<[], { name: string; host: string; port: number }[]>("discover");

// The PC form opens as a modal in the main window (like MAKO's text inputs): the on-screen
// keyboard does not type into text fields inside the Quick Access Menu.
function PcEditModal({ initial, onSave, closeModal }: { initial: Pc; onSave: (pc: Pc) => void; closeModal?: () => void }) {
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
      </DialogBody>
      <DialogFooter>
        <Focusable style={{ display: "flex", gap: "8px" }} flow-children="row">
          <DialogButton onClick={search}>Search the network</DialogButton>
          <DialogButton onClick={closeModal}>Cancel</DialogButton>
          <DialogButton disabled={!valid} onClick={() => {
            onSave({ name: name.trim() || host.trim(), host: host.trim(), port: Number(port) || 47990, token: token.trim() });
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
  useEffect(() => {
    getConfig().then((c) => { setConfig(c); if (c.pcs.length) refresh(); });
    const t = window.setInterval(refresh, 3000);
    return () => window.clearInterval(t);
  }, []);

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

  const edit = (index: number) => {
    Navigation.CloseSideMenus();
    showModal(<PcEditModal initial={index < 0 ? EMPTY : config.pcs[index]}
      onSave={async (pc) => { setConfig(await savePc(index, pc)); setStatus({}); refresh(); }} />);
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
              onChange={async (o) => { setConfig(await selectPc(o.data)); setStatus({}); setNotice(""); refresh(); }}
            />
          </PanelSectionRow>
        )}
        <StatusCard state={state} title={pc.name} lines={[
          [FiWifi, "Address", `${pc.host}:${pc.port || 47990}`],
          [FaSteam, "Steam", online ? (status.steam ? "Open" : "Closed") : "—"],
          [status.muted ? FiVolumeX : FiVolume2, "Volume", volumeText],
        ]} />
        {badToken && <Notice kind="error">The PC refused the token. Check the token install.ps1 showed.</Notice>}
        {badToken && <WideTile icon={FiKey} label="Fix token" t="danger" onClick={() => edit(config.selected)} />}
        {state === "offline" && !badToken && (
          <Notice kind="error">No answer. Is the PC on, on the same network, with the agent running?</Notice>
        )}
        {notice && <Notice kind="info">{notice}</Notice>}
      </PanelSection>

      <CollapsibleSection id="games" title="Games on the PC" icon={FiPlay} t="ok" initiallyCollapsed onExpand={loadGames}
        summary={games && !games.error ? `${games.games.length} installed` : undefined}>
        {!games && <Notice kind="info">Loading the PC's library…</Notice>}
        {games?.error && <Notice kind="error">{games.error}</Notice>}
        {games && !games.error && games.games.length === 0 && <Notice kind="info">No installed Steam games found on this PC.</Notice>}
        {games && !games.error && games.games.length > 0 && online && !status.steam && (
          <>
            <Notice kind="info">Steam is closed on the PC: open it to stream these games.</Notice>
            <WideTile icon={FaSteam} label="Open Steam" t="steam" onClick={() => run("/steam/open", "Opening Steam")} />
          </>
        )}
        {games?.games.map((g) => (
          <GameRow key={g.appid} appid={g.appid} name={g.name} nonSteam={g.nonSteam} playing={g.appid === games.running}
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
