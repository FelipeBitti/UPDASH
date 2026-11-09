"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { criarExtrator, padraoParaRegra, type Regra } from "@/lib/extract";
import { arquivosDoDrop, lerPasta, type ResumoPasta } from "@/lib/parse";
import type { Linha, LinhaX, SiglaRow } from "@/lib/types";
import type { SiglaImport } from "@/lib/parseSiglas";
import { chaveDe, montarMestre, type MestreSalva } from "@/lib/mestre";
import Dashboard from "./Dashboard";
import Mestre from "./Mestre";
import Produtividade from "./Produtividade";
import Pendencias, { type Grupo } from "./Pendencias";
import Regras from "./Regras";
import SiglasTab from "./SiglasTab";

type Aba = "prod" | "dash" | "mestre" | "pend" | "regras" | "siglas";

export default function App() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [aba, setAba] = useState<Aba>("prod");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroDb, setErroDb] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputArqRef = useRef<HTMLInputElement>(null);
  const [resumo, setResumo] = useState<ResumoPasta | null>(null);
  const [progresso, setProgresso] = useState("");
  const [siglas, setSiglas] = useState<SiglaRow[]>([]);
  const [siglasOk, setSiglasOk] = useState(false);
  const conhecidas = useRef<Set<string>>(new Set());
  const [mestreSalvas, setMestreSalvas] = useState<MestreSalva[]>([]);
  const [refChave, setRefChave] = useState("auto");

  const carregarRegras = useCallback(async () => {
    try {
      const r = await fetch("/api/rules");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setRegras(j.regras);
      setErroDb("");
    } catch (e) {
      setErroDb(e instanceof Error ? e.message : "Erro ao ler as regras do banco.");
    }
  }, []);

  useEffect(() => {
    carregarRegras();
  }, [carregarRegras]);

  const carregarSiglas = useCallback(async () => {
    try {
      const r = await fetch("/api/siglas");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setSiglas(j.siglas);
      conhecidas.current = new Set((j.siglas as SiglaRow[]).map((x) => `${x.sigla}|${x.cdPai}`));
      setSiglasOk(true);
    } catch (e) {
      setSiglasOk(false);
      setErroDb((prev) => prev || (e instanceof Error ? e.message : "Erro ao ler o cadastro de siglas."));
    }
  }, []);

  useEffect(() => {
    carregarSiglas();
  }, [carregarSiglas]);

  // Aplica extração (regras aprendidas + automática) e agrupa as pendências por padrão
  const { dados, grupos } = useMemo(() => {
    const extrair = criarExtrator(regras);
    const mapa = new Map<string, Grupo>();
    const dados: LinhaX[] = linhas.map((l) => {
      const r = extrair(l.texto);
      if (r.origem === "pendente") {
        let g = mapa.get(r.padrao);
        if (!g) {
          g = { padrao: r.padrao, tokens: r.tokens, exemplos: [], linhas: 0, sugSigla: r.sugSigla, sugCodigo: r.sugCodigo };
          mapa.set(r.padrao, g);
        }
        g.linhas++;
        if (g.exemplos.length < 3 && !g.exemplos.includes(l.texto)) g.exemplos.push(l.texto);
      }
      return { ...l, sigla: r.sigla ?? "(sem sigla)", codigo: r.codigo ?? "—", origem: r.origem };
    });
    return { dados, grupos: [...mapa.values()].sort((a, b) => b.linhas - a.linhas) };
  }, [linhas, regras]);

  const carregarMestre = useCallback(async () => {
    try {
      const r = await fetch("/api/mestre");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setMestreSalvas(j.linhas);
      setRefChave(j.config?.refUP || "auto");
    } catch (e) {
      setErroDb((prev) => prev || (e instanceof Error ? e.message : "Erro ao ler a Planilha Mestre."));
    }
  }, []);

  useEffect(() => {
    carregarMestre();
  }, [carregarMestre]);

  // A Planilha Mestre é derivada do cadastro de siglas + o que foi digitado à mão: novas combinações entram sozinhas
  const mestre = useMemo(() => montarMestre(siglas, mestreSalvas, refChave), [siglas, mestreSalvas, refChave]);

  const guardarMestre = (x: MestreSalva) =>
    setMestreSalvas((prev) => [...prev.filter((p) => chaveDe(p) !== chaveDe(x)), x]);

  async function salvarMestre(
    l: { produto: string; tensao: string; construtivo: string },
    patch: { rotulo?: string; tempoH?: number | null; pesoMedio?: number | null },
    manual = false,
  ) {
    const r = await fetch("/api/mestre", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produto: l.produto, tensao: l.tensao, construtivo: l.construtivo, manual, ...patch }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Erro ao salvar.");
    guardarMestre(j.linha);
  }

  async function excluirMestre(id: string) {
    const r = await fetch(`/api/mestre?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Erro ao excluir.");
    }
    setMestreSalvas((prev) => prev.filter((x) => x.id !== id));
  }

  async function trocarRef(chave: string) {
    const r = await fetch("/api/mestre/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: "refUP", valor: chave }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Erro ao salvar a referência.");
    }
    setRefChave(chave);
  }

  // Todo par (sigla, CD pai) novo vindo da planilha de produção entra no cadastro de siglas
  useEffect(() => {
    if (!siglasOk || dados.length === 0) return;
    const novos = new Map<string, { sigla: string; cdPai: string }>();
    for (const d of dados) {
      if (d.origem === "pendente" || d.origem === "ignorado") continue;
      if (d.sigla === "(sem sigla)" || d.codigo === "—") continue;
      const k = `${d.sigla}|${d.codigo}`;
      if (!conhecidas.current.has(k) && !novos.has(k)) novos.set(k, { sigla: d.sigla, cdPai: d.codigo });
    }
    if (novos.size === 0) return;
    const pares = [...novos.values()];
    for (const k of novos.keys()) conhecidas.current.add(k); // evita reenvio em loop
    fetch("/api/siglas/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pares }) })
      .then((r) => (r.ok ? carregarSiglas() : Promise.reject()))
      .catch(() => { for (const k of novos.keys()) conhecidas.current.delete(k); });
  }, [dados, siglasOk, carregarSiglas]);

  async function salvarSigla(id: string, patch: Partial<Record<"estrutura" | "kva" | "circuito" | "tipo" | "observacao", string>>) {
    const r = await fetch(`/api/siglas/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Erro ao salvar.");
    setSiglas((prev) => prev.map((x) => (x.id === id ? j.sigla : x)));
  }

  async function importarSiglas(rows: SiglaImport[]) {
    const r = await fetch("/api/siglas/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Erro ao importar.");
    await carregarSiglas();
    return j as { criadas: number; atualizadas: number };
  }

  async function abrir(files: File[] | FileList | null | undefined) {
    const lista = files ? Array.from(files) : [];
    if (lista.length === 0) return;
    setCarregando(true);
    setErro("");
    setProgresso("");
    try {
      const r = await lerPasta(lista, (feito, total, nome) => setProgresso(nome ? `Lendo ${feito + 1}/${total}: ${nome}` : ""));
      setLinhas(r.linhas);
      setResumo(r);
      setArquivo(r.nome);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler a pasta.");
    } finally {
      setCarregando(false);
      setProgresso("");
    }
  }

  async function salvarRegra(g: Grupo, iSigla: number | null, iCodigo: number | null) {
    const r = await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        padrao: padraoParaRegra(g.tokens, iSigla, iCodigo),
        indiceSigla: iSigla,
        indiceCodigo: iCodigo,
        exemplo: g.exemplos[0] ?? "",
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "Erro ao salvar.");
    setRegras((prev) => [j.regra, ...prev.filter((x) => x.padrao !== j.regra.padrao)]);
  }

  async function excluirRegra(id: string) {
    const r = await fetch(`/api/rules?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error ?? "Erro ao excluir.");
    }
    setRegras((prev) => prev.filter((x) => x.id !== id));
  }

  const zona = (
    <div
      className={"drop" + (arrastando ? " on" : "")}
      onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
      onDragLeave={() => setArrastando(false)}
      onDrop={async (e) => { e.preventDefault(); setArrastando(false); abrir(await arquivosDoDrop(e.dataTransfer)); }}
      onClick={() => inputRef.current?.click()}
    >
      <strong>{carregando ? progresso || "Lendo arquivos…" : "Arraste a pasta aqui"}</strong>
      <span>ou clique para escolher a pasta com as planilhas (.xlsx)</span>
    </div>
  );

  return (
    <div className="wrap">
      <header className="topo">
        <div>
          <h1>Dashboard de Produção</h1>
          <p className="sub">{resumo ? `${arquivo} · ${resumo.lidos.length} arquivo${resumo.lidos.length > 1 ? "s" : ""} · ${linhas.length.toLocaleString("pt-BR")} linhas` : "Selecione a pasta com as planilhas de operações para começar"}</p>
        </div>
        <div className="acoes">
          <button className="btn primario" onClick={() => inputRef.current?.click()} disabled={carregando}>
            {carregando ? progresso || "Lendo arquivos…" : arquivo ? "Trocar pasta" : "Selecionar pasta"}
          </button>
          <button className="btn" onClick={() => inputArqRef.current?.click()} disabled={carregando} title="Escolher arquivos avulsos">Arquivos…</button>
        </div>
        <input ref={inputRef} type="file" hidden multiple onChange={(e) => { abrir(e.target.files); e.target.value = ""; }} {...({ webkitdirectory: "", directory: "" } as Record<string, string>)} />
        <input ref={inputArqRef} type="file" accept=".xlsx,.xlsm,.xls" multiple hidden onChange={(e) => { abrir(e.target.files); e.target.value = ""; }} />
      </header>

      {erroDb && <div className="aviso">Banco de dados indisponível: {erroDb} (a extração automática continua funcionando, mas regras não serão salvas.)</div>}
      {erro && <div className="aviso erro">{erro}</div>}
      {resumo && resumo.falhas.length > 0 && (
        <div className="aviso">
          {resumo.falhas.length} arquivo(s) ignorado(s): {resumo.falhas.map((f) => `${f.arquivo} (${f.motivo})`).join("; ")}
        </div>
      )}
      {resumo && resumo.duplicadas > 0 && (
        <div className="aviso">{resumo.duplicadas.toLocaleString("pt-BR")} linhas repetidas entre arquivos foram contadas uma única vez.</div>
      )}

      <nav className="abas">
        <button className={aba === "prod" ? "on" : ""} onClick={() => setAba("prod")}>Produtividade (UP)</button>
        <button className={aba === "dash" ? "on" : ""} onClick={() => setAba("dash")}>Dashboard</button>
        <button className={aba === "mestre" ? "on" : ""} onClick={() => setAba("mestre")}>
          Planilha Mestre
          {mestre.linhas.some((l) => l.tempoH === null || l.pesoMedio === null) && <span className="badge">{mestre.linhas.filter((l) => l.tempoH === null || l.pesoMedio === null).length}</span>}
        </button>
        <button className={aba === "pend" ? "on" : ""} onClick={() => setAba("pend")}>
          Pendências{grupos.length > 0 && <span className="badge">{grupos.length}</span>}
        </button>
        <button className={aba === "siglas" ? "on" : ""} onClick={() => setAba("siglas")}>
          Siglas e CD pai
          {siglas.some((x) => !x.estrutura) && <span className="badge">{siglas.filter((x) => !x.estrutura).length}</span>}
        </button>
        <button className={aba === "regras" ? "on" : ""} onClick={() => setAba("regras")}>
          Regras aprendidas<span className="badge neutro">{regras.length}</span>
        </button>
      </nav>

      {aba === "prod" &&
        (linhas.length === 0 ? (
          zona
        ) : (
          <Produtividade
            dados={dados}
            siglas={siglas}
            mestre={mestre.linhas}
            refDescricao={mestre.refDescricao}
            refTempo={mestre.refTempo}
            onIrMestre={() => setAba("mestre")}
          />
        ))}

      {aba === "mestre" && (
        <Mestre
          linhas={mestre.linhas}
          refTempo={mestre.refTempo}
          refDescricao={mestre.refDescricao}
          refChave={refChave}
          onRef={trocarRef}
          onSalvar={(l, patch) => salvarMestre(l, patch)}
          onAdicionar={(l) => salvarMestre(l, { rotulo: l.rotulo }, true)}
          onExcluir={excluirMestre}
        />
      )}

      {aba === "dash" &&
        (linhas.length === 0 ? (
          zona
        ) : (
          <>
            {grupos.length > 0 && (
              <div className="aviso">
                {grupos.reduce((s, g) => s + g.linhas, 0).toLocaleString("pt-BR")} linhas sem sigla/código definidos em {grupos.length} padrões.{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setAba("pend"); }}>Definir agora</a>
              </div>
            )}
            <Dashboard dados={dados} siglasCad={siglas} />
          </>
        ))}

      {aba === "pend" && <Pendencias grupos={grupos} onSalvar={salvarRegra} temDados={linhas.length > 0} />}
      {aba === "siglas" && <SiglasTab siglas={siglas} onSalvar={salvarSigla} onImportar={importarSiglas} />}
      {aba === "regras" && <Regras regras={regras} onExcluir={excluirRegra} />}
    </div>
  );
}
