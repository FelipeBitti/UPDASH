"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { criarExtrator, padraoParaRegra, type Regra } from "@/lib/extract";
import { lerPlanilha } from "@/lib/parse";
import type { Linha, LinhaX } from "@/lib/types";
import Dashboard from "./Dashboard";
import Pendencias, { type Grupo } from "./Pendencias";
import Regras from "./Regras";

type Aba = "dash" | "pend" | "regras";

export default function App() {
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [regras, setRegras] = useState<Regra[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [aba, setAba] = useState<Aba>("dash");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [erroDb, setErroDb] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

  async function abrir(file: File | undefined | null) {
    if (!file) return;
    setCarregando(true);
    setErro("");
    try {
      const l = await lerPlanilha(file);
      setLinhas(l);
      setArquivo(file.name);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setCarregando(false);
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

  return (
    <div className="wrap">
      <header className="topo">
        <div>
          <h1>Dashboard de Produção</h1>
          <p className="sub">{arquivo ? `${arquivo} · ${linhas.length.toLocaleString("pt-BR")} linhas` : "Carregue a planilha de operações para começar"}</p>
        </div>
        <button className="btn primario" onClick={() => inputRef.current?.click()} disabled={carregando}>
          {carregando ? "Lendo planilha…" : arquivo ? "Trocar planilha" : "Carregar planilha"}
        </button>
        <input ref={inputRef} type="file" accept=".xlsx,.xls" hidden onChange={(e) => abrir(e.target.files?.[0])} />
      </header>

      {erroDb && <div className="aviso">Banco de dados indisponível: {erroDb} (a extração automática continua funcionando, mas regras não serão salvas.)</div>}
      {erro && <div className="aviso erro">{erro}</div>}

      <nav className="abas">
        <button className={aba === "dash" ? "on" : ""} onClick={() => setAba("dash")}>Dashboard</button>
        <button className={aba === "pend" ? "on" : ""} onClick={() => setAba("pend")}>
          Pendências{grupos.length > 0 && <span className="badge">{grupos.length}</span>}
        </button>
        <button className={aba === "regras" ? "on" : ""} onClick={() => setAba("regras")}>
          Regras aprendidas<span className="badge neutro">{regras.length}</span>
        </button>
      </nav>

      {aba === "dash" &&
        (linhas.length === 0 ? (
          <div
            className={"drop" + (arrastando ? " on" : "")}
            onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => { e.preventDefault(); setArrastando(false); abrir(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
          >
            <strong>Arraste a planilha aqui</strong>
            <span>ou clique para escolher um arquivo .xlsx</span>
          </div>
        ) : (
          <>
            {grupos.length > 0 && (
              <div className="aviso">
                {grupos.reduce((s, g) => s + g.linhas, 0).toLocaleString("pt-BR")} linhas sem sigla/código definidos em {grupos.length} padrões.{" "}
                <a href="#" onClick={(e) => { e.preventDefault(); setAba("pend"); }}>Definir agora</a>
              </div>
            )}
            <Dashboard dados={dados} />
          </>
        ))}

      {aba === "pend" && <Pendencias grupos={grupos} onSalvar={salvarRegra} temDados={linhas.length > 0} />}
      {aba === "regras" && <Regras regras={regras} onExcluir={excluirRegra} />}
    </div>
  );
}
