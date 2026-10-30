"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { agrupar, registrosProducao, type GrupoUP, type MestreLinha, type Registro } from "@/lib/mestre";
import type { LinhaX, SiglaRow } from "@/lib/types";

const COR = "#2563eb";
const PALETA = ["#2563eb", "#f97316", "#10b981", "#a855f7", "#ef4444", "#eab308", "#06b6d4", "#64748b", "#84cc16", "#ec4899"];
const f0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const f3 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
const t0 = (v: unknown) => f0.format(Number(v));
const t2 = (v: unknown) => f2.format(Number(v));
const t3 = (v: unknown) => f3.format(Number(v));

type Agrup = "tipoCompleto" | "produto" | "tensao" | "tipoEstrutura" | "sigla";
const AGRUPAMENTOS: { v: Agrup; t: string }[] = [
  { v: "tipoCompleto", t: "Tipo de estrutura (produto + tensão + tipo)" },
  { v: "produto", t: "Produto" },
  { v: "tensao", t: "Tensão" },
  { v: "tipoEstrutura", t: "Tipo construtivo" },
  { v: "sigla", t: "Sigla" },
];

type Props = { dados: LinhaX[]; siglas: SiglaRow[]; mestre: MestreLinha[]; refDescricao: string; refTempo: number | null; onIrMestre: () => void };

export default function Produtividade({ dados, siglas, mestre, refDescricao, refTempo, onIrMestre }: Props) {
  const [fProduto, setProduto] = useState("");
  const [fSigla, setSigla] = useState("");
  const [fTensao, setTensao] = useState("");
  const [fTipo, setTipo] = useState("");
  const [agrup, setAgrup] = useState<Agrup>("tipoCompleto");

  const { registros, tonTotal, tonSemClasse } = useMemo(() => registrosProducao(dados, siglas, mestre), [dados, siglas, mestre]);

  const passa = (r: Registro, ignorar?: "produto" | "sigla" | "tensao" | "tipo") =>
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
  }, [registros, fProduto, fSigla, fTensao, fTipo]);

  const f = useMemo(() => registros.filter((r) => passa(r)), [registros, fProduto, fSigla, fTensao, fTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = useMemo(() => agrupar(f, () => "total")[0], [f]);
  const grupos = useMemo(() => agrupar(f, (r) => r[agrup]), [f, agrup]);
  const porUp = useMemo(() => grupos.filter((g) => g.tonPorUp !== null).sort((a, b) => (b.tonPorUp ?? 0) - (a.tonPorUp ?? 0)).slice(0, 15), [grupos]);
  const porUpTon = useMemo(() => grupos.filter((g) => g.upPorTon !== null).sort((a, b) => (b.upPorTon ?? 0) - (a.upPorTon ?? 0)).slice(0, 15), [grupos]);
  const estUp = useMemo(() => grupos.filter((g) => g.up > 0).slice(0, 15), [grupos]);
  const pizza = useMemo(() => {
    const g = agrupar(f, (r) => r.tipoCompleto).filter((x) => x.up > 0).sort((a, b) => b.up - a.up);
    const top = g.slice(0, 9);
    const resto = g.slice(9).reduce((s, x) => s + x.up, 0);
    return resto > 0 ? [...top, { ...top[0], nome: "Outros", up: resto }] : top;
  }, [f]);

  const compProduto = useMemo(() => comp(agrupar(f, (r) => r.produto)), [f]);
  const compTensao = useMemo(() => comp(agrupar(f, (r) => r.tensao)), [f]);
  const compTipo = useMemo(() => comp(agrupar(f, (r) => r.tipoEstrutura)), [f]);

  const evolucao = useMemo(() => {
    const meses = new Set(f.map((r) => r.dia.slice(0, 7)));
    const porMes = meses.size > 1;
    const g = agrupar(f, (r) => (r.dia ? (porMes ? r.dia.slice(0, 7) : r.dia) : "s/ data")).sort((a, b) => a.nome.localeCompare(b.nome));
    const rot = (n: string) => (n.length === 10 ? `${n.slice(8, 10)}/${n.slice(5, 7)}` : n.length === 7 ? `${n.slice(5, 7)}/${n.slice(0, 4)}` : n);
    return { porMes, dados: g.map((x) => ({ ...x, rotulo: rot(x.nome) })) };
  }, [f]);

  const semParametros = useMemo(() => mestre.filter((m) => m.up === null || !m.pesoMedio).length, [mestre]);
  const pctClass = tonTotal > 0 ? ((tonTotal - tonSemClasse) / tonTotal) * 100 : 100;
  const temFiltro = !!(fProduto || fSigla || fTensao || fTipo);

  return (
    <section>
      <div className="filtros">
        <Sel t="Produto" v={fProduto} set={setProduto} ops={opcoes.produto} />
        <Sel t="Sigla" v={fSigla} set={setSigla} ops={opcoes.sigla} />
        <Sel t="Tensão" v={fTensao} set={setTensao} ops={opcoes.tensao} />
        <Sel t="Tipo de estrutura" v={fTipo} set={setTipo} ops={opcoes.tipo} />
        <label>Agrupar gráficos por
          <select value={agrup} onChange={(e) => setAgrup(e.target.value as Agrup)}>
            {AGRUPAMENTOS.map((a) => <option key={a.v} value={a.v}>{a.t}</option>)}
          </select>
        </label>
        {temFiltro && <button className="btn" onClick={() => { setProduto(""); setSigla(""); setTensao(""); setTipo(""); }}>Limpar</button>}
      </div>

      {!refTempo && (
        <div className="aviso">
          Sem estrutura de referência: informe o tempo de processo da LT 500kV (1 UP) na <a href="#" onClick={(e) => { e.preventDefault(); onIrMestre(); }}>Planilha Mestre</a> para calcular as UP.
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
        <Kpi t="Toneladas produzidas" v={f0.format(total?.ton ?? 0)} />
        <Kpi t="Estruturas (equivalentes)" v={f0.format(total?.estruturas ?? 0)} />
        <Kpi t="UP consumidas" v={f0.format(total?.up ?? 0)} />
        <Kpi t="TON/UP" v={total?.tonPorUp != null ? f2.format(total.tonPorUp) : "—"} />
        <Kpi t="UP/TON" v={total?.upPorTon != null ? f3.format(total.upPorTon) : "—"} />
        <Kpi t="Peso classificado" v={`${f2.format(pctClass)}%`} />
      </div>
      <p className="muted peq" style={{ marginTop: -4 }}>Referência: 1 UP = {refDescricao}{refTempo ? ` (${f2.format(refTempo)} h)` : ""}. Estruturas = toneladas produzidas ÷ peso médio da Planilha Mestre.</p>

      <div className="grade">
        <Cartao titulo="Peso produzido por UP (TON/UP)">
          <Horizontal data={porUp} chave="tonPorUp" nome="TON/UP" fmt={t2} />
        </Cartao>
        <Cartao titulo="UP/TON">
          <Horizontal data={porUpTon} chave="upPorTon" nome="UP/TON" fmt={t3} />
        </Cartao>

        <Cartao titulo="Quantidade de estruturas × UP consumidas">
          <ResponsiveContainer width="100%" height={Math.max(300, estUp.length * 34)}>
            <BarChart data={estUp} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={t0} />
              <YAxis type="category" dataKey="nome" width={170} tick={{ fontSize: 12 }} />
              <Tooltip formatter={t2} />
              <Legend />
              <Bar dataKey="estruturas" name="Estruturas (qtd)" fill="#10b981" />
              <Bar dataKey="up" name="UP consumidas" fill={COR} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="UP consumidas por tipo de estrutura">
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie data={pizza} dataKey="up" nameKey="nome" innerRadius={60} outerRadius={110} paddingAngle={1}>
                {pizza.map((_, i) => <Cell key={i} fill={PALETA[i % PALETA.length]} />)}
              </Pie>
              <Tooltip formatter={t2} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Cartao>
      </div>

      <h3 style={{ margin: "16px 0 8px" }}>Comparativo de produtividade (TON/UP)</h3>
      <div className="grade tres">
        <Cartao titulo="Por produto"><Colunas data={compProduto} /></Cartao>
        <Cartao titulo="Por tensão"><Colunas data={compTensao} /></Cartao>
        <Cartao titulo="Por tipo de estrutura"><Colunas data={compTipo} /></Cartao>
      </div>

      <Cartao titulo={`Produção e TON/UP por ${evolucao.porMes ? "mês" : "dia"}`}>
        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={evolucao.dados} margin={{ right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="rotulo" />
            <YAxis yAxisId="l" tickFormatter={t0} />
            <YAxis yAxisId="r" orientation="right" tickFormatter={t2} />
            <Tooltip formatter={t2} />
            <Legend />
            <Bar yAxisId="l" dataKey="ton" name="Toneladas" fill="#60a5fa" />
            <Line yAxisId="r" dataKey="tonPorUp" name="TON/UP" stroke="#a21caf" strokeWidth={2} dot={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Cartao>

      <div className="cartao">
        <h3>Resumo por {AGRUPAMENTOS.find((a) => a.v === agrup)?.t.toLowerCase()}</h3>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Grupo</th><th className="dir">Toneladas</th><th className="dir">Estruturas</th><th className="dir">UP</th><th className="dir">TON/UP</th><th className="dir">UP/TON</th></tr>
            </thead>
            <tbody>
              {grupos.slice(0, 200).map((g) => (
                <tr key={g.nome}>
                  <td>{g.nome}</td>
                  <td className="dir">{f2.format(g.ton)}</td>
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

const comp = (g: GrupoUP[]) => g.filter((x) => x.tonPorUp !== null).sort((a, b) => (b.tonPorUp ?? 0) - (a.tonPorUp ?? 0));

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

function Horizontal({ data, chave, nome, fmt }: { data: GrupoUP[]; chave: "tonPorUp" | "upPorTon"; nome: string; fmt: (v: unknown) => string }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(300, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={fmt} />
        <YAxis type="category" dataKey="nome" width={170} tick={{ fontSize: 12 }} />
        <Tooltip formatter={fmt} />
        <Bar dataKey={chave} name={nome} fill={COR} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function Colunas({ data }: { data: GrupoUP[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ right: 10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
        <YAxis tickFormatter={t0} />
        <Tooltip formatter={t2} />
        <Bar dataKey="tonPorUp" name="TON/UP" fill={COR} />
      </BarChart>
    </ResponsiveContainer>
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
