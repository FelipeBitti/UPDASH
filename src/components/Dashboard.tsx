"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LinhaX } from "@/lib/types";

const COR = "#2563eb";
const f0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const f1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const tip = (v: unknown) => f0.format(Number(v));
const dia = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "s/ data");

type Agg = { nome: string; peso: number; qtd: number; ordens: number };

function agrupar(linhas: LinhaX[], chave: (l: LinhaX) => string): Agg[] {
  const m = new Map<string, { peso: number; qtd: number; ordens: Set<string> }>();
  for (const l of linhas) {
    const k = chave(l);
    let a = m.get(k);
    if (!a) m.set(k, (a = { peso: 0, qtd: 0, ordens: new Set() }));
    a.peso += l.pesoConf;
    a.qtd += l.qtdBoa;
    a.ordens.add(l.ordem);
  }
  return [...m.entries()].map(([nome, a]) => ({ nome, peso: a.peso, qtd: a.qtd, ordens: a.ordens.size }));
}

export default function Dashboard({ dados }: { dados: LinhaX[] }) {
  const [sigla, setSigla] = useState("");
  const [ct, setCt] = useState("");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  const siglas = useMemo(() => [...new Set(dados.map((d) => d.sigla))].sort(), [dados]);
  const cts = useMemo(() => [...new Set(dados.map((d) => d.centroTrabalho))].sort(), [dados]);

  const f = useMemo(
    () => dados.filter((d) => (!sigla || d.sigla === sigla) && (!ct || d.centroTrabalho === ct) && (!de || d.data >= de) && (!ate || d.data <= ate)),
    [dados, sigla, ct, de, ate],
  );

  const kpi = useMemo(() => {
    const ordens = new Set<string>();
    let peso = 0, qtd = 0, ok = 0;
    for (const d of f) {
      ordens.add(d.ordem);
      peso += d.pesoConf;
      qtd += d.qtdBoa;
      if (d.origem !== "pendente") ok++;
    }
    return { ordens: ordens.size, peso, qtd, siglas: new Set(f.map((d) => d.sigla)).size, ok: f.length ? (ok / f.length) * 100 : 100 };
  }, [f]);

  const porSigla = useMemo(() => agrupar(f, (d) => d.sigla).sort((a, b) => b.peso - a.peso), [f]);
  const porDia = useMemo(() => agrupar(f, (d) => d.data).sort((a, b) => a.nome.localeCompare(b.nome)).map((a) => ({ ...a, rotulo: dia(a.nome) })), [f]);
  const porCt = useMemo(() => agrupar(f, (d) => d.centroTrabalho).sort((a, b) => b.peso - a.peso), [f]);
  const porOp = useMemo(() => agrupar(f, (d) => d.operacao).sort((a, b) => b.peso - a.peso).slice(0, 8), [f]);

  const tabela = useMemo(() => {
    const t = busca.trim().toUpperCase();
    return agrupar(f, (d) => `${d.sigla}\u0000${d.codigo}`)
      .map((a) => {
        const [s, c] = a.nome.split("\u0000");
        return { ...a, sigla: s, codigo: c };
      })
      .filter((a) => !t || a.sigla.includes(t) || a.codigo.includes(t))
      .sort((a, b) => b.peso - a.peso);
  }, [f, busca]);

  return (
    <section>
      <div className="filtros">
        <label>Sigla
          <select value={sigla} onChange={(e) => setSigla(e.target.value)}>
            <option value="">Todas</option>
            {siglas.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Centro de trabalho
          <select value={ct} onChange={(e) => setCt(e.target.value)}>
            <option value="">Todos</option>
            {cts.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>De<input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></label>
        <label>Até<input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></label>
        {(sigla || ct || de || ate) && (
          <button className="btn" onClick={() => { setSigla(""); setCt(""); setDe(""); setAte(""); }}>Limpar</button>
        )}
      </div>

      <div className="kpis">
        <Kpi t="Ordens de produção" v={f0.format(kpi.ordens)} />
        <Kpi t="Peças boas" v={f0.format(kpi.qtd)} />
        <Kpi t="Peso confirmado" v={`${f1.format(kpi.peso / 1000)} t`} />
        <Kpi t="Siglas" v={f0.format(kpi.siglas)} />
        <Kpi t="Linhas resolvidas" v={`${f1.format(kpi.ok)}%`} />
      </div>

      <div className="grade">
        <Cartao titulo="Peso confirmado por sigla (kg) — top 15">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={porSigla.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={tip} />
              <YAxis type="category" dataKey="nome" width={90} />
              <Tooltip formatter={tip} />
              <Bar dataKey="peso" name="Peso (kg)" fill={COR} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="Peso confirmado por dia (kg)">
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={porDia} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="rotulo" />
              <YAxis tickFormatter={tip} />
              <Tooltip formatter={tip} />
              <Bar dataKey="peso" name="Peso (kg)" fill={COR} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="Por centro de trabalho (kg)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porCt} margin={{ right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="nome" />
              <YAxis tickFormatter={tip} />
              <Tooltip formatter={tip} />
              <Bar dataKey="peso" name="Peso (kg)" fill={COR} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>

        <Cartao titulo="Por operação (kg)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porOp} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={tip} />
              <YAxis type="category" dataKey="nome" width={170} />
              <Tooltip formatter={tip} />
              <Bar dataKey="peso" name="Peso (kg)" fill={COR} />
            </BarChart>
          </ResponsiveContainer>
        </Cartao>
      </div>

      <div className="cartao">
        <div className="cartao-topo">
          <h3>Sigla e código</h3>
          <input className="busca" placeholder="Buscar sigla ou código…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr><th>Sigla</th><th>Código</th><th className="dir">Ordens</th><th className="dir">Peças boas</th><th className="dir">Peso (kg)</th></tr>
            </thead>
            <tbody>
              {tabela.slice(0, 200).map((r) => (
                <tr key={r.nome}>
                  <td>{r.sigla}</td><td>{r.codigo}</td>
                  <td className="dir">{f0.format(r.ordens)}</td>
                  <td className="dir">{f0.format(r.qtd)}</td>
                  <td className="dir">{f1.format(r.peso)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tabela.length > 200 && <p className="muted peq">Mostrando 200 de {f0.format(tabela.length)} combinações — use a busca ou os filtros.</p>}
      </div>
    </section>
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
