import type { LinhaX, SiglaRow } from "./types";

// ---------------------------------------------------------------- Planilha Mestre

export const CONSTRUTIVOS = ["Estaiada", "Suspensão", "Ancoragem"];
export const CONSTRUTIVOS_SOLAR = ["Tracker", "Fixo"];
const TODOS_CONSTRUTIVOS = [...CONSTRUTIVOS, ...CONSTRUTIVOS_SOLAR];
const ORDEM_PRODUTO = ["LT", "SE", "Telecom", "Poste LT", "Solar", "Outros", "Gal 3º"];

export type MestreSalva = {
  id: string;
  produto: string;
  tensao: string;
  construtivo: string;
  rotulo: string;
  tempoH: number | null;
  pesoMedio: number | null;
  manual: boolean;
};

export type MestreChave = { produto: string; tensao: string; construtivo: string };

export type MestreLinha = MestreChave & {
  chave: string;
  rotulo: string;
  tipo: string; // texto exibido na coluna "Tipo"
  tipoEstrutura: string; // usado em filtros/agrupamentos
  tempoH: number | null; // h por estrutura (manual)
  pesoMedio: number | null; // t por estrutura (manual)
  up: number | null; // tempo / tempo da referência
  upPorTon: number | null;
  tonPorUp: number | null;
  id: string | null;
  manual: boolean;
  nSiglas: number;
  ehRef: boolean;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const chaveDe = (c: MestreChave) => `${c.produto}|${c.tensao}|${c.construtivo}`;

export function produtoDe(estrutura: string): string {
  const e = estrutura.trim().toUpperCase();
  if (e === "LT") return "LT";
  if (e === "SE") return "SE";
  if (e === "POSTE") return "Poste LT";
  if (e === "TELECOM") return "Telecom";
  return e.charAt(0) + e.slice(1).toLowerCase();
}

export function tensaoDe(kva: string): string {
  const t = kva.trim().replace(/\s+/g, "").replace(/kv$/i, "");
  return t ? `${t}kV` : "";
}

export function construtivoDe(produto: string, tipo: string): string {
  const lista = produto === "LT" ? CONSTRUTIVOS : produto === "Solar" ? CONSTRUTIVOS_SOLAR : [];
  return lista.find((c) => semAcento(c) === semAcento(tipo.trim())) ?? "";
}

// Classifica uma sigla do cadastro na linha da Planilha Mestre (null = ainda sem estrutura)
export function chaveDaSigla(s: Pick<SiglaRow, "estrutura" | "kva" | "tipo">): MestreChave | null {
  if (!s.estrutura.trim()) return null;
  const produto = produtoDe(s.estrutura);
  return { produto, tensao: tensaoDe(s.kva), construtivo: construtivoDe(produto, s.tipo) };
}

const numKV = (t: string) => parseFloat(t.replace(",", ".")) || 0;

export function montarMestre(siglas: SiglaRow[], salvas: MestreSalva[], refChave: string) {
  const base = new Map<string, MestreChave & { nSiglas: number }>();
  for (const s of siglas) {
    const k = chaveDaSigla(s);
    if (!k) continue;
    const c = chaveDe(k);
    const e = base.get(c);
    if (e) e.nSiglas++;
    else base.set(c, { ...k, nSiglas: 1 });
  }
  const salvaPor = new Map<string, MestreSalva>();
  for (const s of salvas) {
    const c = chaveDe(s);
    salvaPor.set(c, s);
    if (!base.has(c)) base.set(c, { produto: s.produto, tensao: s.tensao, construtivo: s.construtivo, nSiglas: 0 });
  }

  type Pre = MestreChave & { chave: string; rotulo: string; tempoH: number | null; pesoMedio: number | null; id: string | null; manual: boolean; nSiglas: number };
  const pre: Pre[] = [...base.entries()].map(([chave, b]) => {
    const sv = salvaPor.get(chave);
    return {
      produto: b.produto, tensao: b.tensao, construtivo: b.construtivo, chave,
      rotulo: sv?.rotulo ?? "", tempoH: sv?.tempoH ?? null, pesoMedio: sv?.pesoMedio ?? null,
      id: sv?.id ?? null, manual: sv?.manual ?? false, nSiglas: b.nSiglas,
    };
  });

  const ordemProd = (p: string) => {
    const i = ORDEM_PRODUTO.indexOf(p);
    return i < 0 ? ORDEM_PRODUTO.length : i;
  };
  pre.sort(
    (a, b) =>
      ordemProd(a.produto) - ordemProd(b.produto) ||
      a.produto.localeCompare(b.produto) ||
      numKV(b.tensao) - numKV(a.tensao) ||
      TODOS_CONSTRUTIVOS.indexOf(a.construtivo) - TODOS_CONSTRUTIVOS.indexOf(b.construtivo),
  );

  // Referência (1 UP): por padrão, média do tempo das linhas LT 500kV
  let refTempo: number | null = null;
  let refDescricao = "LT 500kV — informe o tempo de processo";
  const auto = !refChave || refChave === "auto";
  const refs = new Set<string>();
  if (auto) {
    const arr = pre.filter((p) => p.produto === "LT" && p.tensao === "500kV" && (p.tempoH ?? 0) > 0);
    if (arr.length) {
      refTempo = arr.reduce((s, p) => s + (p.tempoH as number), 0) / arr.length;
      refDescricao = arr.length > 1 ? "LT 500kV (média dos tipos)" : `LT ${arr[0].tensao}${arr[0].construtivo ? " " + arr[0].construtivo : ""}`;
      arr.forEach((p) => refs.add(p.chave));
    }
  } else {
    const r = pre.find((p) => p.chave === refChave);
    if (r && (r.tempoH ?? 0) > 0) {
      refTempo = r.tempoH;
      refDescricao = `${r.produto} ${[r.tensao, r.construtivo].filter(Boolean).join(" ")}`.trim();
      refs.add(r.chave);
    } else if (r) refDescricao = "Referência escolhida sem tempo de processo";
  }

  const linhas: MestreLinha[] = pre.map((p) => {
    const up = refTempo && p.tempoH && p.tempoH > 0 ? p.tempoH / refTempo : null;
    const peso = p.pesoMedio && p.pesoMedio > 0 ? p.pesoMedio : null;
    return {
      ...p,
      tipo: p.rotulo || [p.tensao, p.construtivo].filter(Boolean).join(" ") || "—",
      tipoEstrutura: p.construtivo || p.rotulo || "—",
      up,
      upPorTon: up !== null && peso ? up / peso : null,
      tonPorUp: up && peso ? peso / up : null,
      ehRef: refs.has(p.chave),
    };
  });
  return { linhas, refTempo, refDescricao };
}

// ---------------------------------------------------------------- Produção × Mestre

export type Registro = {
  sigla: string;
  cd: string;
  chave: string;
  produto: string;
  tensao: string;
  tipoEstrutura: string;
  tipoCompleto: string;
  dia: string;
  ton: number;
  estruturas: number | null;
  up: number | null;
};

export function registrosProducao(linhas: LinhaX[], siglas: SiglaRow[], mestre: MestreLinha[]) {
  const porChave = new Map(mestre.map((m) => [m.chave, m]));
  const porPar = new Map<string, MestreLinha>();
  for (const s of siglas) {
    const k = chaveDaSigla(s);
    const m = k && porChave.get(chaveDe(k));
    if (m) porPar.set(`${s.sigla}|${s.cdPai}`, m);
  }

  const acc = new Map<string, { sigla: string; cd: string; dia: string; kg: number; m: MestreLinha }>();
  let kgTotal = 0;
  let kgSemClasse = 0;
  for (const l of linhas) {
    if (l.sigla === "(sem sigla)" || l.codigo === "—") continue;
    kgTotal += l.pesoConf;
    const m = porPar.get(`${l.sigla}|${l.codigo}`);
    if (!m) {
      kgSemClasse += l.pesoConf;
      continue;
    }
    const k = `${l.sigla}|${l.codigo}|${l.data}`;
    const a = acc.get(k);
    if (a) a.kg += l.pesoConf;
    else acc.set(k, { sigla: l.sigla, cd: l.codigo, dia: l.data, kg: l.pesoConf, m });
  }

  const registros: Registro[] = [];
  for (const a of acc.values()) {
    const ton = a.kg / 1000;
    const estruturas = a.m.pesoMedio && a.m.pesoMedio > 0 ? ton / a.m.pesoMedio : null;
    const up = estruturas !== null && a.m.up !== null ? estruturas * a.m.up : null;
    registros.push({
      sigla: a.sigla, cd: a.cd, chave: a.m.chave, produto: a.m.produto, tensao: a.m.tensao || "—",
      tipoEstrutura: a.m.tipoEstrutura, tipoCompleto: `${a.m.produto} · ${a.m.tipo}`,
      dia: a.dia, ton, estruturas, up,
    });
  }
  return { registros, tonTotal: kgTotal / 1000, tonSemClasse: kgSemClasse / 1000 };
}

export type GrupoUP = {
  nome: string;
  ton: number;
  estruturas: number;
  up: number;
  tonComUP: number;
  tonPorUp: number | null;
  upPorTon: number | null;
};

export function agrupar(regs: Registro[], chave: (r: Registro) => string): GrupoUP[] {
  const m = new Map<string, GrupoUP>();
  for (const r of regs) {
    const k = chave(r);
    let g = m.get(k);
    if (!g) m.set(k, (g = { nome: k, ton: 0, estruturas: 0, up: 0, tonComUP: 0, tonPorUp: null, upPorTon: null }));
    g.ton += r.ton;
    if (r.estruturas !== null) g.estruturas += r.estruturas;
    if (r.up !== null) {
      g.up += r.up;
      g.tonComUP += r.ton;
    }
  }
  for (const g of m.values()) {
    g.tonPorUp = g.up > 0 ? g.tonComUP / g.up : null;
    g.upPorTon = g.tonComUP > 0 ? g.up / g.tonComUP : null;
  }
  return [...m.values()].sort((a, b) => b.ton - a.ton);
}
