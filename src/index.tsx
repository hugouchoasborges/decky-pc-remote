import {
  ButtonItem,
  ConfirmModal,
  Dropdown,
  Field,
  PanelSection,
  PanelSectionRow,
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

function PcEditor({ initial, onSave, onCancel }: { initial: Pc; onSave: (pc: Pc) => void; onCancel: () => void }) {
  const [pc, setPc] = useState<Pc>(initial);
  const set = (k: keyof Pc) => (e: any) => setPc({ ...pc, [k]: k === "port" ? Number(e.target.value) || 47990 : e.target.value });
  return (
    <>
      <PanelSectionRow><TextField label="Nome" value={pc.name} onChange={set("name")} /></PanelSectionRow>
      <PanelSectionRow><TextField label="IP ou nome do PC" value={pc.host} onChange={set("host")} /></PanelSectionRow>
      <PanelSectionRow><TextField label="Porta" value={String(pc.port)} onChange={set("port")} /></PanelSectionRow>
      <PanelSectionRow><TextField label="Token" value={pc.token} onChange={set("token")} /></PanelSectionRow>
      <PanelSectionRow>
        <ButtonItem layout="below" disabled={!pc.host || !pc.token} onClick={() => onSave({ ...pc, name: pc.name || pc.host })}>Salvar</ButtonItem>
      </PanelSectionRow>
      <PanelSectionRow><ButtonItem layout="below" onClick={onCancel}>Cancelar</ButtonItem></PanelSectionRow>
    </>
  );
}

function Content() {
  const [config, setConfig] = useState<Config>({ pcs: [], selected: 0 });
  const [status, setStatus] = useState<Status>({});
  const [editing, setEditing] = useState<number | null>(null); // index, or -1 for a new PC
  const volTimer = useRef<number>();

  const refresh = async () => setStatus(await getStatus());
  useEffect(() => {
    getConfig().then((c) => { setConfig(c); if (c.pcs.length) refresh(); else setEditing(-1); });
    const t = window.setInterval(refresh, 3000);
    return () => window.clearInterval(t);
  }, []);

  const run = async (path: string, done: string) => {
    const r = await command(path);
    if (r.error) toaster.toast({ title: "PC Remote", body: r.error });
    else toaster.toast({ title: "PC Remote", body: done });
    setTimeout(refresh, 1500);
  };
  const confirm = (title: string, path: string, done: string) =>
    showModal(<ConfirmModal strTitle={title} strDescription="Tem certeza?" strOKButtonText="Sim" strCancelButtonText="Não" onOK={() => run(path, done)} />);

  const onVolume = (v: number) => {
    setStatus((s) => ({ ...s, volume: v }));
    window.clearTimeout(volTimer.current);
    volTimer.current = window.setTimeout(async () => setStatus(await setVolume(v)), 200);
  };

  if (editing !== null) {
    return (
      <PanelSection title={editing < 0 ? "Adicionar PC" : "Editar PC"}>
        <PcEditor
          initial={editing < 0 ? EMPTY : config.pcs[editing]}
          onSave={async (pc) => { setConfig(await savePc(editing, pc)); setEditing(null); refresh(); }}
          onCancel={() => setEditing(null)}
        />
      </PanelSection>
    );
  }

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

      <PanelSection title="Energia">
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => run("/screen/off", "Tela desligada")}>Desligar só a tela</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => confirm("Suspender o PC?", "/power/suspend", "Suspendendo")}>Suspender</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => confirm("Reiniciar o PC?", "/power/restart", "Reiniciando")}>Reiniciar</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" disabled={!online} onClick={() => confirm("Desligar o PC?", "/power/shutdown", "Desligando")}>Desligar</ButtonItem></PanelSectionRow>
      </PanelSection>

      <PanelSection title="Configurar">
        <PanelSectionRow><ButtonItem layout="below" disabled={!pc} onClick={() => setEditing(config.selected)}>Editar este PC</ButtonItem></PanelSectionRow>
        <PanelSectionRow><ButtonItem layout="below" onClick={() => setEditing(-1)}>Adicionar outro PC</ButtonItem></PanelSectionRow>
        {pc && (
          <PanelSectionRow>
            <ButtonItem layout="below" onClick={() => showModal(<ConfirmModal strTitle={`Remover ${pc.name}?`} strOKButtonText="Remover" strCancelButtonText="Cancelar"
              onOK={async () => { setConfig(await removePc(config.selected)); setStatus({}); refresh(); }} />)}>Remover este PC</ButtonItem>
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
