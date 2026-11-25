import {
  ButtonItem,
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
  ToggleField,
  showModal,
  staticClasses,
} from "@decky/ui";
import { callable, definePlugin, toaster } from "@decky/api";
import { useEffect, useRef, useState } from "react";
import { FaDesktop } from "react-icons/fa";

type Pc = { name: string; host: string; port: number; token: string };
type Config = { pcs: Pc[]; selected: number };
type Status = { host?: string; steam?: boolean; volume?: number; muted?: boolean; error?: string };

const getConfig = callable<[], Config>("get_config");
const savePc = callable<[number, Pc], Config>("save_pc");
const removePc = callable<[number], Config>("remove_pc");
const selectPc = callable<[number], Config>("select_pc");
const getStatus = callable<[], Status>("status");
const command = callable<[string], Status & { ok?: boolean }>("command");
const setVolume = callable<[number], Status>("set_volume");

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
    setFound("Procurando…");
    const list = await discover();
    if (!list.length) { setFound("Nenhum PC encontrado (o agente está rodando e o firewall liberado?)"); return; }
    const pick = list.find((d) => d.name.toLowerCase() === name.trim().toLowerCase()) ?? list[0];
    setName(pick.name); setHost(pick.host); setPort(String(pick.port));
    setFound(`Encontrado: ${list.map((d) => `${d.name} (${d.host})`).join(", ")}`);
  };
  const valid = host.trim() && token.trim();
  return (
    <ModalRoot onCancel={closeModal}>
      <DialogHeader>{initial.host ? "Editar PC" : "Adicionar PC"}</DialogHeader>
      <DialogBody>
        <Field label="Nome" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={name} onChange={(e) => setName(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        <Field label="IP ou nome do PC" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={host} onChange={(e) => setHost(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        <Field label="Porta" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={port} onChange={(e) => setPort(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        <Field label="Token" description="Mostrado pelo install.ps1 no PC" childrenLayout="below" childrenContainerWidth="max">
          <TextField value={token} onChange={(e) => setToken(e?.target?.value ?? "")} style={{ width: "100%" }} />
        </Field>
        {found && <Field label={found} />}
      </DialogBody>
      <DialogFooter>
        <Focusable style={{ display: "flex", gap: "8px" }} flow-children="row">
          <DialogButton onClick={search}>Procurar na rede</DialogButton>
          <DialogButton onClick={closeModal}>Cancelar</DialogButton>
          <DialogButton disabled={!valid} onClick={() => {
            onSave({ name: name.trim() || host.trim(), host: host.trim(), port: Number(port) || 47990, token: token.trim() });
            closeModal?.();
          }}>Salvar</DialogButton>
        </Focusable>
      </DialogFooter>
    </ModalRoot>
  );
}

function Content() {
  const [config, setConfig] = useState<Config>({ pcs: [], selected: 0 });
  const [status, setStatus] = useState<Status>({});
  const volTimer = useRef<number>();

  const refresh = async () => setStatus(await getStatus());
  useEffect(() => {
    getConfig().then((c) => { setConfig(c); if (c.pcs.length) refresh(); });
    const t = window.setInterval(refresh, 3000);
    return () => window.clearInterval(t);
  }, []);

  const run = async (path: string, done: string) => {
    const r = await command(path);
    if (r.error) toaster.toast({ title: "PC Remote", body: r.error });
    else toaster.toast({ title: "PC Remote", body: done });
    setTimeout(refresh, 1500);
  };
  // The modal opens in the main window: close the Quick Access Menu first so it is not hidden behind it.
  const confirm = (title: string, path: string, done: string) => { Navigation.CloseSideMenus();
    showModal(<ConfirmModal strTitle={title} strDescription="Tem certeza?" strOKButtonText="Sim" strCancelButtonText="Não" onOK={() => run(path, done)} />); };

  const onVolume = (v: number) => {
    setStatus((s) => ({ ...s, volume: v }));
    window.clearTimeout(volTimer.current);
    volTimer.current = window.setTimeout(async () => setStatus(await setVolume(v)), 200);
  };

  const edit = (index: number) => {
    Navigation.CloseSideMenus();
    showModal(<PcEditModal initial={index < 0 ? EMPTY : config.pcs[index]}
      onSave={async (pc) => { setConfig(await savePc(index, pc)); setStatus({}); refresh(); }} />);
  };

  const pc = config.pcs[config.selected];
  const online = !status.error && status.host !== undefined;
  return (
    <>
      <PanelSection title="PC">
        {config.pcs.length > 1 && (
          <PanelSectionRow>
            <Dropdown
              rgOptions={config.pcs.map((p, i) => ({ data: i, label: p.name }))}
              selectedOption={config.selected}
              onChange={async (o) => { setConfig(await selectPc(o.data)); setStatus({}); refresh(); }}
            />
          </PanelSectionRow>
        )}
        <PanelSectionRow>
          <Field label={pc?.name ?? "—"} description={status.error ?? (online ? `Ligado (${status.host})` : "Conectando…")} />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Steam">
        <PanelSectionRow>
          {status.steam
            ? <ButtonItem layout="below" disabled={!online} onClick={() => run("/steam/close", "Fechando a Steam")}>Fechar Steam</ButtonItem>
            : <ButtonItem layout="below" disabled={!online} onClick={() => run("/steam/open", "Abrindo a Steam")}>Abrir Steam</ButtonItem>}
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Volume">
        <PanelSectionRow>
          <SliderField label="Volume" value={status.volume ?? 0} min={0} max={100} step={2} showValue disabled={!online} onChange={onVolume} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ToggleField label="Mudo" checked={!!status.muted} disabled={!online} onChange={async () => setStatus(await command("/mute"))} />
        </PanelSectionRow>
      </PanelSection>

      <PanelSection title="Tela">
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => run("/screen/off", "Tela desligada")}>Desligar só a tela</ButtonItem></PanelSectionRow>
      </PanelSection>

      <PanelSection title="Energia (pede confirmação)">
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => confirm("Suspender o PC?", "/power/suspend", "Suspendendo")}>Suspender</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => confirm("Reiniciar o PC?", "/power/restart", "Reiniciando")}>Reiniciar</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => confirm("Desligar o PC?", "/power/shutdown", "Desligando")}>Desligar</ButtonItem></PanelSectionRow>
      </PanelSection>

      <PanelSection title="Configurar">
        <PanelSectionRow><ButtonItem layout="below" disabled={!pc} onClick={() => edit(config.selected)}>Editar este PC</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" onClick={() => edit(-1)}>Adicionar outro PC</ButtonItem></PanelSectionRow>
        {pc && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => { Navigation.CloseSideMenus(); showModal(<ConfirmModal strTitle={`Remover ${pc.name}?`} strOKButtonText="Remover" strCancelButtonText="Cancelar"
              onOK={async () => { setConfig(await removePc(config.selected)); setStatus({}); refresh(); }} />); }}>Remover este PC</ButtonItem>
          </PanelSectionRow>
        )}
      </PanelSection>
    </>
  );
}

export default definePlugin(() => ({
  name: "PC Remote",
  titleView: <div className={staticClasses.Title}>PC Remote</div>,
  content: <Content />,
  icon: <FaDesktop />,
}));
