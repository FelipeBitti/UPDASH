"use client";

import { useState } from "react";
import type { Regra } from "@/lib/extract";

export default function Regras({ regras, onExcluir }: { regras: Regra[]; onExcluir: (id: string) => Promise<void> }) {
  const [erro, setErro] = useState("");

  if (regras.length === 0) return <p className="vazio">Nenhuma regra salva ainda. As regras aparecem aqui quando você define itens na aba Pendências.</p>;

  return (
    <section>
      {erro && <div className="aviso erro">{erro}</div>}
      <div className="tabela-wrap">
        <table>
          <thead>
            <tr>
              <th>Formato</th>
              <th>Exemplo</th>
              <th>Sigla (posição)</th>
              <th>Código (posição)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {regras.map((r) => (
              <tr key={r.id}>
                <td><code>{r.padrao}</code></td>
                <td>{r.exemplo}</td>
                <td>{r.indiceSigla === null && r.indiceCodigo === null ? <em>ignorar</em> : r.indiceSigla ?? "—"}</td>
                <td>{r.indiceCodigo ?? "—"}</td>
                <td className="dir">
                  <button
                    className="btn peq"
                    onClick={() => onExcluir(r.id).catch((e) => setErro(e instanceof Error ? e.message : "Erro ao excluir."))}
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted peq">Posição conta a partir de 0 (primeira palavra do texto).</p>
    </section>
  );
}
