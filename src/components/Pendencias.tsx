"use client";

import { useState } from "react";
import { padraoParaRegra } from "@/lib/extract";

export type Grupo = {
  padrao: string;
  tokens: string[];
  exemplos: string[];
  linhas: number;
  sugSigla: number | null;
  sugCodigo: number | null;
};

type Props = {
  grupos: Grupo[];
  temDados: boolean;
  onSalvar: (g: Grupo, iSigla: number | null, iCodigo: number | null) => Promise<void>;
};

export default function Pendencias({ grupos, temDados, onSalvar }: Props) {
  const [limite, setLimite] = useState(20);

  if (!temDados) return <p className="vazio">Carregue uma planilha para ver as pendências.</p>;
  if (grupos.length === 0) return <p className="vazio">Nenhuma pendência — todas as linhas já têm sigla/código definidos.</p>;

  return (
    <section>
      <p className="ajuda">
        Estes textos não seguem o formato padrão. Para cada grupo, clique na palavra que é a <b>sigla</b> e na que é o <b>código</b> (ou deixe
        sem código). A regra é salva no banco e passa a valer para todos os textos de mesmo formato, hoje e nas próximas planilhas.
      </p>
      {grupos.slice(0, limite).map((g) => (
        <Cartao key={g.padrao} g={g} onSalvar={onSalvar} />
      ))}
      {grupos.length > limite && (
        <button className="btn" onClick={() => setLimite(limite + 20)}>
          Mostrar mais ({grupos.length - limite} restantes)
        </button>
      )}
    </section>
  );
}

function Cartao({ g, onSalvar }: { g: Grupo; onSalvar: Props["onSalvar"] }) {
  const [s, setS] = useState<number | null>(g.sugSigla);
  const [c, setC] = useState<number | null>(g.sugCodigo);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const conflito = s !== null && s === c;
  const padraoSalvo = padraoParaRegra(g.tokens, s, c);

  async function salvar(is: number | null, ic: number | null) {
    setBusy(true);
    setErro("");
    try {
      await onSalvar(g, is, ic);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
      setBusy(false);
    }
  }

  return (
    <div className="cartao">
      <div className="cartao-topo">
        <code className="exemplo">{g.exemplos[0]}</code>
        <span className="muted">{g.linhas.toLocaleString("pt-BR")} linhas</span>
      </div>
      {g.exemplos.length > 1 && <div className="muted peq">Outros: {g.exemplos.slice(1).join(" · ")}</div>}

      <Fila titulo="Sigla" tokens={g.tokens} valor={s} onChange={setS} />
      <Fila titulo="Código" tokens={g.tokens} valor={c} onChange={setC} />

      <div className="cartao-rodape">
        <span className="muted peq">
          Sigla: <b>{s !== null ? g.tokens[s] : "—"}</b> · Código: <b>{c !== null ? g.tokens[c] : "—"}</b>
          <span className="padrao"> · formato: {padraoSalvo}</span>
        </span>
        <div className="acoes">
          <button className="btn" disabled={busy} onClick={() => salvar(null, null)} title="Não extrair nada deste formato">
            Ignorar formato
          </button>
          <button className="btn primario" disabled={busy || conflito || (s === null && c === null)} onClick={() => salvar(s, c)}>
            Salvar regra
          </button>
        </div>
      </div>
      {conflito && <div className="erro-txt">Sigla e código não podem ser a mesma palavra.</div>}
      {erro && <div className="erro-txt">{erro}</div>}
    </div>
  );
}

function Fila({ titulo, tokens, valor, onChange }: { titulo: string; tokens: string[]; valor: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="fila">
      <span className="fila-t">{titulo}</span>
      {tokens.map((t, i) => (
        <button key={i} type="button" className={"chip" + (valor === i ? " on" : "")} onClick={() => onChange(valor === i ? null : i)}>
          {t}
        </button>
      ))}
    </div>
  );
}
