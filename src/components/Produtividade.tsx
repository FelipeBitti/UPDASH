"use client";

import { useMemo, useState } from "react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { agrupar, registrosProducao, type GrupoUP, type MestreLinha, type Registro } from "@/lib/mestre";
import type { LinhaX, SiglaRow } from "@/lib/types";

// Cores iguais às do gráfico de referência (Excel "UP Brasa")
const C_TON = "#4472C4";
const C_EQ = "#C00000";
const C_UP = "#A5A5A5";
const C_TONUP = "#FFC000";
const PALETA = ["#4472C4", "#ED7D31", "#70AD47", "#7030A0", "#C00000", "#FFC000", "#00B0F0", "#7F7F7F", "#84cc16", "#ec4899"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const f0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const f2x = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f3 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const t0 = (v: unknown) => f0.format(Number(v));
const t2x = (v: unknown) => f2x.format(Number(v));
const tEixo = (v: unknown) => (Number(v) === 0 ? "-" : f0.format(Number(v)));

// ---- Estilo minimalista compartilhado pelos gráficos ----
const COR_TXT = "#9ca3af";
const COR_GRADE = "#f0f1f4";
const eixoX = { tick: { fontSize: 11, fill: COR_TXT }, axisLine: { stroke: "#e5e7eb" }, tickLine: false, interval: 0 as const };
const eixoY = { tick: { fontSize: 11, fill: COR_TXT }, axisLine: false, tickLine: false, width: 48 };
const Grade = () => <CartesianGrid stroke={COR_GRADE} vertical={false} />;
const legenda = { verticalAlign: "top" as const, align: "left" as const, iconType: "circle" as const, iconSize: 8, height: 28, wrapperStyle: { fontSize: 12, color: "#6b7280", paddingBottom: 8 } };

// Dica (tooltip) enxuta
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Dica({ active, payload, label, sufixo }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 10px", fontSize: 12, boxShadow: "0 4px 14px rgba(0,0,0,.06)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.filter((p: any) => p.value !== null && p.value !== undefined).map((p: any) => (
        <div key={p.dataKey} style={{ display: "flex", alignItems: "center", gap: 6, color: "#374151" }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: p.color || p.stroke || p.fill, display: "inline-block" }} />
          <span style={{ flex: 1 }}>{p.name}</span>
          <strong>{f2.format(Number(p.value))}{sufixo ?? ""}</strong>
        </div>
      ))}
    </div>
  );
}

type Agrup = "tipoCompleto" | "produto" | "tensao" | "tipoEstrutura" | "sigla";
const AGRUPAMENTOS: { v: Agrup; t: string }[] = [
  { v: "tipoCompleto", t: "Tipo de estrutura (produto + tensão + tipo)" },
  { v: "produto", t: "Produto" },
  { v: "tensao", t: "Tensão" },
  { v: "tipoEstrutura", t: "Tipo construtivo" },
  { v: "sigla", t: "Sigla" },
];

type Ponto = GrupoUP & { rotulo: string; tonEq: number | null };
type Props = { dados: LinhaX[]; siglas: SiglaRow[]; mestre: MestreLinha[]; refDescricao: string; refTempo: number | null; onIrMestre: () => void };

export default function Produtividade({ dados, siglas, mestre, refDescricao, refTempo, onIrMestre }: Props) {
  const [fProduto, setProduto] = useState("");
  const [fSigla, setSigla] = useState("");
  const [fTensao, setTensao] = useState("");
  const [fTipo, setTipo] = useState("");
  const [agrup, setAgrup] = useState<Agrup>("tipoCompleto");
  const [periodo, setPeriodo] = useState<"mes" | "dia">("mes");
  const [ano, setAno] = useState("auto"); // "auto" = ano mais recente com dados; "todos" = sem filtro de ano
  const [rotulos, setRotulos] = useState(false);

  const { registros, tonTotal, tonSemClasse } = useMemo(() => registrosProducao(dados, siglas, mestre), [dados, siglas, mestre]);

  // Peso da estrutura padrão (referência de 1 UP): média do peso médio das linhas de referência da Planilha Mestre
  const pesoPadrao = useMemo(() => {
    const p = mestre.filter((m) => m.ehRef && (m.pesoMedio ?? 0) > 0).map((m) => m.pesoMedio as number);
    return p.length ? p.reduce((a, b) => a + b, 0) / p.length : null;
  }, [mestre]);

  const anos = useMemo(() => [...new Set(registros.filter((r) => r.dia).map((r) => r.dia.slice(0, 4)))].sort(), [registros]);
  const anoEf = ano === "todos" ? "" : ano !== "auto" && anos.includes(ano) ? ano : anos[anos.length - 1] ?? "";

  const passa = (r: Registro, ignorar?: "produto" | "sigla" | "tensao" | "tipo") =>
    (!anoEf || r.dia.slice(0, 4) === anoEf) &&
    (ignorar === "produto" || !fProduto || r.produto === fProduto) &&
    (ignorar === "sigla" || !fSigla || r.sigla === fSigla) &&
    (ignorar === "tensao" || !fTensao || r.tensao === fTensao) &&
    (ignorar === "tipo" || !fTipo || r.tipoEstrutura === fTipo);

  // opções em cascata: cada filtro mostra só o que existe com os outros filtros aplicados
  const opcoes = useMemo(() => {
    const u = (ig: "produto" | "sigla" | "tensao" | "tipo", f: (r: Registro) => string) =>
      [...new Set(registros.filter((r) => passa(r, ig)).map(f))].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
    return { produto: u("produto", (r) => r.produto), sigla: u("sigla", (r) => r.sigla), tensao: u("tensao", (r) => r.tensao), tipo: u("tipo", (r) => r.tipoEstrutura) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, anoEf, fProduto, fSigla, fTensao, fTipo]);

  const f = useMemo(() => registros.filter((r) => passa(r)), [registros, anoEf, fProduto, fSigla, fTensao, fTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  // TON/EQ = UP produzidas × peso da estrutura padrão
  const comEq = (g: GrupoUP[]): Ponto[] => g.map((x) => ({ ...x, rotulo: x.nome, tonEq: pesoPadrao !== null ? x.up * pesoPadrao : null }));

  const total = useMemo(() => agrupar(f, () => "total")[0], [f]);
  const tonEqTotal = pesoPadrao !== null && total ? total.up * pesoPadrao : null;

  const porGrupo = (chave: (r: Registro) => string, n = 15) =>
    comEq(agrupar(f, chave).filter((g) => g.up > 0).sort((a, b) => b.up - a.up).slice(0, n));
  const grupos = useMemo(() => agrupar(f, (r) => r[agrup]), [f, agrup]);
  const gAgrup = useMemo(() => porGrupo((r) => r[agrup], 20), [f, agrup, pesoPadrao]); // eslint-disable-line react-hooks/exhaustive-deps
  const gProduto = useMemo(() => porGrupo((r) => r.produto), [f, pesoPadrao]); // eslint-disable-line react-hooks/exhaustive-deps
  const gTensao = useMemo(() => porGrupo((r) => r.tensao), [f, pesoPadrao]); // eslint-disable-line react-hooks/exhaustive-deps
  const gTipo = useMemo(() => porGrupo((r) => r.tipoEstrutura), [f, pesoPadrao]); // eslint-disable-line react-hooks/exhaustive-deps

  // Evolução no tempo (visão principal, formato da imagem de referência)
  const evolucao = useMemo(() => {
    const chave = (r: Registro) => (r.dia ? (periodo === "mes" ? r.dia.slice(0, 7) : r.dia) : "s/ data");
    const anos = new Set(f.filter((r) => r.dia).map((r) => r.dia.slice(0, 4)));
    const rot = (n: string) => {
      if (n.length === 10) return `${n.slice(8, 10)}/${n.slice(5, 7)}`;
      if (n.length === 7) {
        const m = MESES[Number(n.slice(5, 7)) - 1] ?? n.slice(5, 7);
        return anos.size > 1 ? `${m}/${n.slice(2, 4)}` : m;
      }
      return n;
    };
    const ord = [...anos].sort();
    const titulo = ord.length === 0 ? "UP Brasa" : ord.length === 1 ? `UP Brasa ${ord[0]}` : `UP Brasa ${ord[0]}–${ord[ord.length - 1]}`;
    const g = agrupar(f, chave).sort((a, b) => a.nome.localeCompare(b.nome));
    const pontos: Ponto[] = comEq(g).map((x) => ({ ...x, rotulo: rot(x.nome) }));

    let aT = 0, aE = 0, aU = 0;
    const acumulado = pontos.map((p) => {
      aT += p.ton; aE += p.tonEq ?? 0; aU += p.up;
      return { rotulo: p.rotulo, ton: aT, tonEq: pesoPadrao !== null ? aE : null, up: aU };
    });

    const produtos = [...new Set(f.filter((r) => r.up !== null).map((r) => r.produto))];
    const emp = new Map<string, Record<string, number | string>>();
    for (const r of f) {
      if (r.up === null) continue;
      const k = chave(r);
      let o = emp.get(k);
      if (!o) emp.set(k, (o = { nome: k, rotulo: rot(k) }));
      o[r.produto] = ((o[r.produto] as number) ?? 0) + r.up;
    }
    const empilhado = [...emp.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
    return { titulo, pontos, acumulado, produtos, empilhado };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f, periodo, pesoPadrao]);

  // Aderência ao padrão: TON/UP do grupo ÷ peso da estrutura padrão (100% = igual à referência)
  const aderencia = useMemo(
    () =>
      pesoPadrao === null
        ? []
        : grupos
            .filter((g) => g.tonPorUp !== null)
            .map((g) => ({ nome: g.nome, indice: ((g.tonPorUp as number) / pesoPadrao) * 100 }))
            .sort((a, b) => b.indice - a.indice)
            .slice(0, 20),
    [grupos, pesoPadrao],
  );

  const semParametros = useMemo(() => mestre.filter((m) => m.up === null || !m.pesoMedio).length, [mestre]);
  const pctClass = tonTotal > 0 ? ((tonTotal - tonSemClasse) / tonTotal) * 100 : 100;
  const temFiltro = !!(fProduto || fSigla || fTensao || fTipo);
  const nomeAgrup = AGRUPAMENTOS.find((a) => a.v === agrup)?.t.toLowerCase() ?? "";

  return (
    <section>
      <div className="filtros">
        <label>Ano
          <select value={anoEf || "todos"} onChange={(e) => setAno(e.target.value)}>
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
            <option value="todos">Todos os anos</option>
          </select>
        </label>
        <Sel t="Produto" v={fProduto} set={setProduto} ops={opcoes.produto} />
        <Sel t="Sigla" v={fSigla} set={setSigla} ops={opcoes.sigla} />
        <Sel t="Tensão" v={fTensao} set={setTensao} ops={opcoes.tensao} />
        <Sel t="Tipo de estrutura" v={fTipo} set={setTipo} ops={opcoes.tipo} />
        <label>Agrupar gráficos por
          <select value={agrup} onChange={(e) => setAgrup(e.target.value as Agrup)}>
            {AGRUPAMENTOS.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
          </select>
        </label>
        <label>Período
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value as "mes" | "dia")}>
            <option value="mes">Mensal</option>
            <option value="dia">Diário</option>
          </select>
        </label>
        <label style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 8 }}>
          <input type="checkbox" checked={rotulos} onChange={(e) => setRotulos(e.target.checked)} /> Mostrar valores
        </label>
        {temFiltro && <button className="btn" onClick={() => { setProduto(""); setSigla(""); setTensao(""); setTipo(""); }}>Limpar</button>}
      </div>

      {!refTempo && (
        <div className="aviso">
          Sem estrutura de referência: informe o tempo de processo da LT 500kV (1 UP) na <a href="#" onClick={(e) => { e.preventDefault(); onIrMestre(); }}>Planilha Mestre</a> para calcular as UP.
        </div>
      )}
      {refTempo && pesoPadrao === null && (
        <div className="aviso">
          Sem peso médio na estrutura de referência: informe o peso médio da LT 500kV na <a href="#" onClick={(e) => { e.preventDefault(); onIrMestre(); }}>Planilha Mestre</a> para calcular a TON/EQ.
        </div>
      )}
      {refTempo && semParametros > 0 && (
        <div className="aviso">
          {semParametros} linhas da Planilha Mestre sem tempo ou peso médio ficam fora dos cálculos de UP.{" "}
          <a href="#" onClick={(e) => { e.preventDefault(); onIrMestre(); }}>Preencher</a>
        </div>
      )}
      {tonSemClasse > 0 && (
        <div className="aviso">
          {f0.format(tonSemClasse)} t ({f2.format(100 - pctClass)}% do peso) são de siglas ainda sem estrutura definida e não entram nesta tela. Classifique-as na aba “Siglas e CD pai”.
        </div>
      )}

      <div className="kpis">
        <Kpi t="Toneladas produzidas (TON)" v={f0.format(total?.ton ?? 0)} />
        <Kpi t="Tonelada equivalente (TON/EQ)" v={tonEqTotal !== null ? f0.format(tonEqTotal) : "—"} />
        <Kpi t="UP produzidas" v={f2.format(total?.up ?? 0)} />
        <Kpi t="TON/UP" v={total?.tonPorUp != null ? f2.format(total.tonPorUp) : "—"} />
        <Kpi t="Peso da estrutura padrão (t)" v={pesoPadrao !== null ? f2.format(pesoPadrao) : "—"} />
        <Kpi t="Peso classificado" v={`${f2.format(pctClass)}%`} />
      </div>
      <p className="muted peq" style={{ marginTop: -4 }}>
        Referência: 1 UP = {refDescricao}{refTempo ? ` (${f2.format(refTempo)} h)` : ""}. TON/EQ = UP produzidas × peso da estrutura padrão{pesoPadrao !== null ? ` (${f2.format(pesoPadrao)} t)` : ""}. TON/UP = toneladas ÷ UP.
      </p>

      {/* Evolução em linhas: peso produzido, tonelada equivalente e tonelada por UP */}
      <Cartao titulo={`Evolução ${anoEf || ""} · peso produzido, tonelada equivalente e tonelada por UP`.replace("  ", " ")}>
        <GraficoLinhas data={evolucao.pontos} altura={320} rotulos={rotulos} />
      </Cartao>

      {/* Visão principal: mesmo formato do gráfico de referência */}
      <Cartao titulo={evolucao.titulo}>
        <GraficoUP data={evolucao.pontos} altura={380} rotulos={rotulos} />
      </Cartao>

      <Cartao titulo={`UP Brasa por ${nomeAgrup}`}>
        <GraficoUP data={gAgrup} altura={400} rotulos={rotulos} />
      </Cartao>

      <h3 style={{ margin: "16px 0 8px" }}>Comparativos (TON, TON/EQ, UP e TON/UP)</h3>
      <div className="grade">
        <Cartao titulo="Por produto"><GraficoUP data={gProduto} altura={340} rotulos={rotulos} /></Cartao>
        <Cartao titulo="Por tensão"><GraficoUP data={gTensao} altura={340} rotulos={rotulos} /></Cartao>
      </div>
      <Cartao titulo="Por tipo construtivo"><GraficoUP data={gTipo} altura={340} rotulos={rotulos} /></Cartao>

      <h3 style={{ margin: "16px 0 8px" }}>Outras visões</h3>
      <div className="grade">
        <Cartao titulo={`Acumulado no ${periodo === "mes" ? "ano" : "período"}: TON, TON/EQ e UP`}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={evolucao.acumulado} margin={{ top: 4, right: 8, left: 0 }}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis yAxisId="l" tickFormatter={tEixo} {...eixoY} />
              <YAxis yAxisId="r" orientation="right" tickFormatter={t0} {...eixoY} />
              <Tooltip content={<Dica />} />
              <Legend {...legenda} />
              <Area yAxisId="l" dataKey="ton" name="TON" stroke={C_TON} fill={C_TON} fillOpacity={0.08} strokeWidth={2} dot={false} />
              <Area yAxisId="l" dataKey="tonEq" name="TON/EQ" stroke={C_EQ} fill={C_EQ} fillOpacity={0.06} strokeWidth={2} dot={false} />
              <Line yAxisId="r" dataKey="up" name="UP" stroke={C_UP} strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo={`UP produzidas por ${periodo === "mes" ? "mês" : "dia"} e produto`}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={evolucao.empilhado} margin={{ top: 4, right: 8, left: 0 }}>
              <Grade />
              <XAxis dataKey="rotulo" {...eixoX} />
              <YAxis tickFormatter={tEixo} {...eixoY} />
              <Tooltip content={<Dica />} cursor={{ fill: "#f9fafb" }} />
              <Legend {...legenda} />
              {evolucao.produtos.map((p, i) => <Bar key={p} dataKey={p} stackId="up" name={p} fill={PALETA[i % PALETA.length]} maxBarSize={36} isAnimationActive={false} />)}
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      </div>

      <Cartao titulo={`Aderência ao padrão por ${nomeAgrup} (TON/UP ÷ peso da estrutura padrão, %)`}>
        {aderencia.length === 0 ? (
          <p className="muted peq">Informe o peso médio da estrutura de referência na Planilha Mestre para ver este gráfico.</p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(300, aderencia.length * 30)}>
            <BarChart data={aderencia} layout="vertical" margin={{ left: 10, right: 40 }}>
              <CartesianGrid stroke={COR_GRADE} horizontal={false} />
              <XAxis type="number" tickFormatter={t0} tick={{ fontSize: 11, fill: COR_TXT }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="nome" width={190} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip content={<Dica sufixo="%" />} cursor={{ fill: "#f9fafb" }} />
              <ReferenceLine x={100} stroke={C_EQ} strokeDasharray="4 4" label={{ value: "Padrão 100%", position: "top", fontSize: 11, fill: C_EQ }} />
              <Bar dataKey="indice" name="Aderência (%)" fill={C_TON} maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                <LabelList dataKey="indice" position="right" formatter={t0} style={{ fontSize: 11, fill: "#6b7280" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </Cartao>

      <div className="cartao">
        <h3>Resumo por {nomeAgrup}</h3>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Grupo</th><th className="dir">TON</th><th className="dir">TON/EQ</th><th className="dir">Estruturas</th><th className="dir">UP</th><th className="dir">TON/UP</th><th className="dir">UP/TON</th></tr>
            </thead>
            <tbody>
              {grupos.slice(0, 200).map((g) => (
                <tr key={g.nome}>
                  <td>{g.nome}</td>
                  <td className="dir">{f2.format(g.ton)}</td>
                  <td className="dir">{pesoPadrao !== null && g.up ? f2.format(g.up * pesoPadrao) : "—"}</td>
                  <td className="dir">{g.estruturas ? f2.format(g.estruturas) : "—"}</td>
                  <td className="dir">{g.up ? f2.format(g.up) : "—"}</td>
                  <td className="dir">{g.tonPorUp !== null ? f2.format(g.tonPorUp) : "—"}</td>
                  <td className="dir">{g.upPorTon !== null ? f3.format(g.upPorTon) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// Rótulo discreto acima da coluna (só aparece com "Mostrar valores")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rotuloTopo(p: any) {
  const { x, y, width, value } = p;
  if (value === null || value === undefined) return null;
  return (
    <text x={Number(x) + Number(width) / 2} y={Number(y) - 5} fill="#6b7280" fontSize={10} textAnchor="middle">
      {f0.format(Number(value))}
    </text>
  );
}

const rotuloLinha = { fontSize: 10, fill: "#6b7280" };

// Evolução em linhas: TON e TON/EQ (eixo esquerdo) + TON/UP (eixo direito)
function GraficoLinhas({ data, altura, rotulos }: { data: Ponto[]; altura: number; rotulos: boolean }) {
  if (data.length === 0) return <p className="muted peq">Sem dados para os filtros atuais.</p>;
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <ComposedChart data={data} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
        <Grade />
        <XAxis dataKey="rotulo" {...eixoX} />
        <YAxis yAxisId="l" tickFormatter={tEixo} {...eixoY} />
        <YAxis yAxisId="r" orientation="right" tickFormatter={t2x} domain={["auto", "auto"]} {...eixoY} />
        <Tooltip content={<Dica />} cursor={{ stroke: "#e5e7eb" }} />
        <Legend {...legenda} />
        <Line yAxisId="l" dataKey="ton" name="Peso produzido (TON)" stroke={C_TON} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: C_TON }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false}>
          {rotulos && <LabelList dataKey="ton" position="top" formatter={t0} style={rotuloLinha} />}
        </Line>
        <Line yAxisId="l" dataKey="tonEq" name="Tonelada equivalente (TON/EQ)" stroke={C_EQ} strokeWidth={2} dot={{ r: 3, strokeWidth: 0, fill: C_EQ }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false}>
          {rotulos && <LabelList dataKey="tonEq" position="bottom" formatter={t0} style={rotuloLinha} />}
        </Line>
        <Line yAxisId="r" dataKey="tonPorUp" name="Tonelada por UP (TON/UP)" stroke={C_TONUP} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, strokeWidth: 0, fill: C_TONUP }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false}>
          {rotulos && <LabelList dataKey="tonPorUp" position="top" formatter={t2x} style={rotuloLinha} />}
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Colunas TON e TON/EQ (eixo esquerdo) + linhas UP e TON/UP (eixo direito), no formato "UP Brasa", em visual limpo
function GraficoUP({ data, altura, rotulos }: { data: Ponto[]; altura: number; rotulos: boolean }) {
  if (data.length === 0) return <p className="muted peq">Sem dados com UP para os filtros atuais.</p>;
  const largura = Math.max(560, data.length * 96);
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ minWidth: largura }}>
        <ResponsiveContainer width="100%" height={altura}>
          <ComposedChart data={data} margin={{ top: 22, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="30%">
            <Grade />
            <XAxis dataKey="rotulo" {...eixoX} />
            <YAxis yAxisId="l" tickFormatter={tEixo} {...eixoY} />
            <YAxis yAxisId="r" orientation="right" tickFormatter={t2x} {...eixoY} />
            <Tooltip content={<Dica />} cursor={{ fill: "#f9fafb" }} />
            <Legend {...legenda} />
            <Bar yAxisId="l" dataKey="ton" name="TON" fill={C_TON} fillOpacity={0.9} maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {rotulos && <LabelList dataKey="ton" content={rotuloTopo} />}
            </Bar>
            <Bar yAxisId="l" dataKey="tonEq" name="TON/EQ" fill={C_EQ} fillOpacity={0.9} maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false}>
              {rotulos && <LabelList dataKey="tonEq" content={rotuloTopo} />}
            </Bar>
            <Line yAxisId="r" dataKey="up" name="UP" stroke={C_UP} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: C_UP }} connectNulls isAnimationActive={false}>
              {rotulos && <LabelList dataKey="up" position="top" formatter={t2x} style={rotuloLinha} />}
            </Line>
            <Line yAxisId="r" dataKey="tonPorUp" name="TON/UP" stroke={C_TONUP} strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0, fill: C_TONUP }} connectNulls isAnimationActive={false}>
              {rotulos && <LabelList dataKey="tonPorUp" position="top" formatter={t2x} style={rotuloLinha} />}
            </Line>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Sel({ t, v, set, ops }: { t: string; v: string; set: (v: string) => void; ops: string[] }) {
  return (
    <label>{t}
      <select value={v} onChange={(e) => set(e.target.value)}>
        <option value="">Todos</option>
        {v && !ops.includes(v) && <option>{v}</option>}
        {ops.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Kpi({ t, v }: { t: string; v: string }) {
  return (
    <div className="kpi">
      <span>{t}</span>
      <strong>{v}</strong>
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="cartao">
      <h3>{titulo}</h3>
      {children}
    </div>
  );
}
