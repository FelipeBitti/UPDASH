import type { Linha } from "./types";

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return 0;
  let s = v.trim();
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function dataISO(v: unknown): string {
  if (typeof v === "number" && v > 20000) {
    return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const br = v.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[0];
  }
  return "";
}

const COLS = {
  ordem: "ordem de producao",
  texto: "texto breve material",
  operacao: "txt.breve operacao",
  centroTrabalho: "centro de trabalho",
  qtdBoa: "qtd.boa total",
  pesoConf: "peso qtd.boa total confirmada",
  pesoOrdem: "peso ordem",
  data: "data entrada",
} as const;

export async function lerPlanilha(file: File): Promise<Linha[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: "" });

  const hIdx = m.slice(0, 15).findIndex((r) => r.some((c) => norm(c) === COLS.texto));
  if (hIdx < 0) throw new Error('Coluna "Texto breve Material" não encontrada na planilha.');

  const head = m[hIdx].map(norm);
  const col = (nome: string) => head.indexOf(nome);
  const ix = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, col(v)])) as Record<keyof typeof COLS, number>;

  const out: Linha[] = [];
  for (let i = hIdx + 1; i < m.length; i++) {
    const r = m[i];
    const texto = String(r[ix.texto] ?? "").trim();
    if (!texto && !r[ix.ordem]) continue;
    out.push({
      ordem: String(r[ix.ordem] ?? ""),
      texto,
      operacao: String(r[ix.operacao] ?? "").trim() || "—",
      centroTrabalho: String(r[ix.centroTrabalho] ?? "").trim() || "—",
      qtdBoa: ix.qtdBoa >= 0 ? num(r[ix.qtdBoa]) : 0,
      pesoConf: ix.pesoConf >= 0 ? num(r[ix.pesoConf]) : 0,
      pesoOrdem: ix.pesoOrdem >= 0 ? num(r[ix.pesoOrdem]) : 0,
      data: ix.data >= 0 ? dataISO(r[ix.data]) : "",
    });
  }
  return out;
}
