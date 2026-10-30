"use client";

import { useEffect, useMemo, useState } from "react";
import { CONSTRUTIVOS, CONSTRUTIVOS_SOLAR, type MestreLinha } from "@/lib/mestre";

type Patch = { rotulo?: string; tempoH?: number | null; pesoMedio?: number | null };

type Props = {
  linhas: MestreLinha[];
  refTempo: number | null;
  refDescricao: string;
  refChave: string;
  onRef: (chave: string) => Promise<void>;
  onSalvar: (l: Pick<MestreLinha, "produto" | "tensao" | "construtivo">, patch: Patch) => Promise<void>;
  onAdicionar: (l: { produto: string; tensao: string; construtivo: string; rotulo: string }) => Promise<void>;
  onExcluir: (id: string) => Promise<void>;
};

const f2 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f3 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const mostra = (v: number | null, f = f2) => (v === null ? "—" : f.format(v));

export default function Mestre({ linhas, refTempo, refDescricao, refChave, onRef, onSalvar, onAdicionar, onExcluir }: Props) {
  const [erro, setErro] = useState("");
  const [novo, setNovo] = useState({ produto: "", tensao: "", construtivo: "", rotulo: "" });

  const produtos = useMemo(() => [...new Set(linhas.map((l) => l.produto))], [linhas]);
  const faltando = linhas.filter((l) => l.tempoH === null || l.pesoMedio === null).length;
  const wrap = (p: Promise<void>) => p.then(() => setErro("")).catch((e) => setErro(e instanceof Error ? e.message : "Erro ao salvar."));

  async function exportar() {
    const XLSX = await import("xlsx");
    const dados = linhas.map((l) => ({
      Produto: l.produto,
      Tipo: l.tipo,
      "Tempo processo (h)": l.tempoH ?? "",
      "U.P.": l.up ?? "",
      "Toneladas/estrutura": l.pesoMedio ?? "",
      "U.P./ton": l.upPorTon ?? "",
      "ton/U.P.": l.tonPorUp ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Planilha Mestre");
    XLSX.writeFile(wb, "Planilha_Mestre.xlsx");
  }

  async function adicionar() {
    if (!novo.produto.trim()) return;
    await wrap(onAdicionar(novo).then(() => setNovo({ produto: "", tensao: "", construtivo: "", rotulo: "" })));
  }

  let grupo = -1;
  let anterior = "";

  return (
    <section>
      <p className="ajuda">
        As linhas nascem do cadastro de siglas (produto, tensão e tipo construtivo) e novas combinações entram sozinhas, sem duplicar. Preencha o{" "}
        <b>tempo de processo</b> e o <b>peso médio</b> de cada estrutura: UP, UP/ton e ton/UP são calculados na hora e alimentam a tela de Produtividade.
        Fórmula: <b>UP = tempo da estrutura ÷ tempo da referência</b>.
      </p>

      <div className="filtros">
        <label>Estrutura de referência (1 UP)
          <select value={refChave} onChange={(e) => wrap(onRef(e.target.value))}>
            <option value="auto">LT 500kV — média dos tipos (padrão)</option>
            {linhas.map((l) => (
              <option key={l.chave} value={l.chave}>{l.produto} {l.tipo}</option>
            ))}
          </select>
        </label>
        <div className="kpi" style={{ minWidth: 220 }}>
          <span>Referência atual</span>
          <strong style={{ fontSize: 16 }}>{refDescricao}{refTempo ? ` · ${f2.format(refTempo)} h` : ""}</strong>
        </div>
        <button className="btn" disabled={linhas.length === 0} onClick={exportar}>Exportar Excel</button>
      </div>

      {!refTempo && <div className="aviso">Informe o tempo de processo da estrutura de referência para calcular as UP.</div>}
      {faltando > 0 && linhas.length > 0 && <div className="aviso">{faltando} linhas ainda sem tempo ou peso médio.</div>}
      {erro && <div className="aviso erro">{erro}</div>}

      {linhas.length === 0 ? (
        <p className="vazio">A Planilha Mestre ainda está vazia. Classifique as siglas na aba “Siglas e CD pai” (Estrutura, KVA e, para LT e Solar, o Tipo) ou adicione uma linha manual abaixo.</p>
      ) : (
        <div className="tabela-wrap tall">
          <table className="mestre">
            <thead>
              <tr>
                <th>Produto</th><th>Tipo</th><th className="dir">Tempo processo (h)</th><th className="dir">U.P.</th>
                <th className="dir">Toneladas/estrutura</th><th className="dir">U.P./ton</th><th className="dir">ton/U.P.</th><th className="dir">Siglas</th><th></th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const novoGrupo = l.produto !== anterior;
                if (novoGrupo) grupo++;
                anterior = l.produto;
                return (
                  <tr key={l.chave} className={(grupo % 2 ? "zebra " : "") + (novoGrupo ? "topo-grupo" : "")}>
                    <td><b>{novoGrupo ? l.produto : ""}</b></td>
                    <td>
                      {!l.tensao && !l.construtivo ? (
                        <TextoCel valor={l.rotulo} placeholder="ex.: Base triangular" onSalvar={(v) => wrap(onSalvar(l, { rotulo: v }))} />
                      ) : (
                        <b>{l.tipo}</b>
                      )}
                    </td>
                    <td className={"dir" + (l.ehRef ? " ref" : "")}><NumCel valor={l.tempoH} onSalvar={(v) => wrap(onSalvar(l, { tempoH: v }))} /></td>
                    <td className={"dir" + (l.ehRef ? " ref" : "")}>{mostra(l.up)}</td>
                    <td className="dir"><NumCel valor={l.pesoMedio} onSalvar={(v) => wrap(onSalvar(l, { pesoMedio: v }))} /></td>
                    <td className="dir">{mostra(l.upPorTon, f3)}</td>
                    <td className="dir">{mostra(l.tonPorUp)}</td>
                    <td className="dir muted">{l.nSiglas || "—"}</td>
                    <td className="dir">
                      {l.manual && l.id && (
                        <button className="btn peq" onClick={() => wrap(onExcluir(l.id as string))}>Excluir</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="cartao" style={{ marginTop: 16 }}>
        <h3>Adicionar linha manual (ex.: Solar, Gal 3º)</h3>
        <div className="filtros" style={{ marginBottom: 0 }}>
          <label>Produto
            <input className="busca" list="produtos-mestre" value={novo.produto} onChange={(e) => setNovo({ ...novo, produto: e.target.value })} placeholder="ex.: Solar" />
          </label>
          <label>Tensão
            <input className="busca" value={novo.tensao} onChange={(e) => setNovo({ ...novo, tensao: e.target.value })} placeholder="ex.: 230kV" />
          </label>
          <label>Tipo construtivo
            <select value={novo.construtivo} onChange={(e) => setNovo({ ...novo, construtivo: e.target.value })}>
              <option value="">—</option>
              {[...CONSTRUTIVOS, ...CONSTRUTIVOS_SOLAR].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label>Rótulo do tipo
            <input className="busca" value={novo.rotulo} onChange={(e) => setNovo({ ...novo, rotulo: e.target.value })} placeholder="ex.: Fixo, Tracker" />
          </label>
          <button className="btn primario" disabled={!novo.produto.trim()} onClick={adicionar}>Adicionar</button>
        </div>
        <datalist id="produtos-mestre">{produtos.map((p) => <option key={p} value={p} />)}</datalist>
      </div>
    </section>
  );
}

function NumCel({ valor, onSalvar }: { valor: number | null; onSalvar: (v: number | null) => void }) {
  const fmt = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
  const [t, setT] = useState(fmt(valor));
  useEffect(() => setT(fmt(valor)), [valor]);

  function fim() {
    const s = t.trim();
    const n = s === "" ? null : parseFloat(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
    if (n !== null && (!Number.isFinite(n) || n < 0)) return setT(fmt(valor));
    if (n !== valor) onSalvar(n);
  }
  return <input className="cel num" inputMode="decimal" value={t} placeholder="0,00" onChange={(e) => setT(e.target.value)} onBlur={fim} />;
}

function TextoCel({ valor, placeholder, onSalvar }: { valor: string; placeholder: string; onSalvar: (v: string) => void }) {
  const [t, setT] = useState(valor);
  useEffect(() => setT(valor), [valor]);
  return <input className="cel" value={t} placeholder={placeholder} onChange={(e) => setT(e.target.value)} onBlur={() => t !== valor && onSalvar(t)} />;
}
