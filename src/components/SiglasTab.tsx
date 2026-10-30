"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SiglaRow } from "@/lib/types";
import { lerSiglas, type SiglaImport } from "@/lib/parseSiglas";
import { CIRCUITOS, ESTRUTURAS, KVAS, statusDe, temCircuito, temKva, temTipo, tiposDe } from "@/lib/siglas";

type Campos = "estrutura" | "kva" | "circuito" | "tipo" | "observacao";

type Props = {
  siglas: SiglaRow[];
  onSalvar: (id: string, patch: Partial<Record<Campos, string>>) => Promise<void>;
  onImportar: (rows: SiglaImport[]) => Promise<{ criadas: number; atualizadas: number }>;
};

type Filtro = "preencher" | "pendente" | "completo" | "todos";
const POR_PAGINA = 50;

export default function SiglasTab({ siglas, onSalvar, onImportar }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("preencher");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const cont = useMemo(() => {
    const c = { pendente: 0, incompleto: 0, completo: 0 };
    for (const s of siglas) c[statusDe(s)]++;
    return c;
  }, [siglas]);

  const lista = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return siglas.filter((s) => {
      const st = statusDe(s);
      if (filtro === "preencher" && st === "completo") return false;
      if (filtro === "pendente" && st !== "pendente") return false;
      if (filtro === "completo" && st !== "completo") return false;
      return !t || s.sigla.includes(t) || s.cdPai.includes(t);
    });
  }, [siglas, filtro, busca]);

  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const pg = Math.min(pagina, paginas - 1);
  const visiveis = lista.slice(pg * POR_PAGINA, pg * POR_PAGINA + POR_PAGINA);

  async function importar(file: File | undefined | null) {
    if (!file) return;
    setBusy(true);
    setMsg("Lendo planilha…");
    try {
      const rows = await lerSiglas(file);
      let criadas = 0, atualizadas = 0;
      for (let i = 0; i < rows.length; i += 300) {
        setMsg(`Importando… ${Math.min(i + 300, rows.length)} de ${rows.length}`);
        const r = await onImportar(rows.slice(i, i + 300));
        criadas += r.criadas;
        atualizadas += r.atualizadas;
      }
      setMsg(`Importação concluída: ${criadas} siglas novas e ${atualizadas} existentes completadas (campos já preenchidos não são sobrescritos).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro ao importar.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function exportar() {
    const XLSX = await import("xlsx");
    const dados = siglas.map((s) => ({
      SIGLA: s.sigla, "CD PAI": s.cdPai, Estrutura: s.estrutura, KVA: s.kva,
      Circuito: s.circuito, TIPO: s.tipo, Observação: s.observacao,
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siglas");
    XLSX.writeFile(wb, "Siglas.xlsx");
  }

  return (
    <section>
      <p className="ajuda">
        Cada par <b>sigla + CD pai</b> novo que aparece numa planilha de produção é cadastrado aqui automaticamente. Preencha Estrutura, KVA e
        Observação; <b>Circuito</b> só vale para <b>LT</b>; <b>Tipo</b> vale para <b>LT</b> (Estaiada, Suspensão, Ancoragem) e <b>SOLAR</b> (Tracker, Fixo), que não tem KVA nem circuito. Os dados salvam ao escolher/sair do campo.
      </p>

      <div className="filtros">
        <label>Mostrar
          <select value={filtro} onChange={(e) => { setFiltro(e.target.value as Filtro); setPagina(0); }}>
            <option value="preencher">A preencher ({cont.pendente + cont.incompleto})</option>
            <option value="pendente">Sem estrutura ({cont.pendente})</option>
            <option value="completo">Completas ({cont.completo})</option>
            <option value="todos">Todas ({siglas.length})</option>
          </select>
        </label>
        <label>Buscar
          <input className="busca" placeholder="Sigla ou CD pai…" value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} />
        </label>
        <button className="btn" disabled={busy} onClick={() => inputRef.current?.click()}>Importar planilha de siglas</button>
        <button className="btn" disabled={siglas.length === 0} onClick={exportar}>Exportar Excel</button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => importar(e.target.files?.[0])} />
      </div>
      {msg && <div className="aviso">{msg}</div>}

      {siglas.length === 0 ? (
        <p className="vazio">Nenhuma sigla cadastrada. Carregue uma planilha de produção ou importe a planilha de siglas.</p>
      ) : (
        <>
          <div className="tabela-wrap tall">
            <table>
              <thead>
                <tr><th>Sigla</th><th>CD pai</th><th>Estrutura</th><th>KVA</th><th>Circuito</th><th>Tipo</th><th>Observação</th><th></th></tr>
              </thead>
              <tbody>
                {visiveis.map((s) => <Linha key={s.id} s={s} onSalvar={onSalvar} />)}
              </tbody>
            </table>
          </div>
          <div className="paginacao">
            <button className="btn peq" disabled={pg === 0} onClick={() => setPagina(pg - 1)}>Anterior</button>
            <span className="muted peq">Página {pg + 1} de {paginas} · {lista.length} siglas</span>
            <button className="btn peq" disabled={pg >= paginas - 1} onClick={() => setPagina(pg + 1)}>Próxima</button>
          </div>
        </>
      )}
      <datalist id="kvas">{KVAS.map((k) => <option key={k} value={k} />)}</datalist>
    </section>
  );
}

function Linha({ s, onSalvar }: { s: SiglaRow; onSalvar: Props["onSalvar"] }) {
  const [kva, setKva] = useState(s.kva);
  const [obs, setObs] = useState(s.observacao);
  const [estado, setEstado] = useState<"" | "salvando" | "ok" | "erro">("");

  useEffect(() => setKva(s.kva), [s.kva]);
  useEffect(() => setObs(s.observacao), [s.observacao]);

  async function salvar(patch: Partial<Record<Campos, string>>) {
    setEstado("salvando");
    try {
      await onSalvar(s.id, patch);
      setEstado("ok");
    } catch {
      setEstado("erro");
    }
  }

  const opc = (base: string[], atual: string) => (atual && !base.includes(atual) ? [...base, atual] : base);

  return (
    <tr>
      <td><b>{s.sigla}</b></td>
      <td><code>{s.cdPai}</code></td>
      <td>
        <select className="cel" value={s.estrutura} onChange={(e) => salvar({ estrutura: e.target.value })}>
          <option value="">—</option>
          {opc(ESTRUTURAS, s.estrutura).map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <input className="cel" list="kvas" value={kva} placeholder="ex.: 69KV" disabled={!temKva(s.estrutura)}
          onChange={(e) => setKva(e.target.value)} onBlur={() => kva !== s.kva && salvar({ kva })} />
      </td>
      <td>
        <select className="cel" value={s.circuito} disabled={!temCircuito(s.estrutura)} onChange={(e) => salvar({ circuito: e.target.value })}>
          <option value="">—</option>
          {opc(CIRCUITOS, s.circuito).map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <select className="cel" value={s.tipo} disabled={!temTipo(s.estrutura)} onChange={(e) => salvar({ tipo: e.target.value })}>
          <option value="">—</option>
          {opc(tiposDe(s.estrutura), s.tipo).map((o) => <option key={o}>{o}</option>)}
        </select>
      </td>
      <td>
        <input className="cel larga" value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => obs !== s.observacao && salvar({ observacao: obs })} />
      </td>
      <td className="peq muted estado">{estado === "salvando" ? "salvando…" : estado === "ok" ? "salvo" : estado === "erro" ? "erro" : ""}</td>
    </tr>
  );
}
