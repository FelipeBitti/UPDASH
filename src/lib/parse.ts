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

// ---------- Leitura de pasta (vários arquivos) ----------

const EXT_OK = /\.(xlsx|xlsm|xls)$/i;
const arquivoValido = (f: File) => EXT_OK.test(f.name) && !f.name.startsWith("~$");

export type ResumoPasta = {
  nome: string; // nome da pasta (ou "N arquivos")
  lidos: string[];
  falhas: { arquivo: string; motivo: string }[];
  duplicadas: number; // linhas repetidas entre arquivos, ignoradas
  linhas: Linha[];
};

const chaveLinha = (l: Linha) => [l.ordem, l.texto, l.operacao, l.centroTrabalho, l.qtdBoa, l.pesoConf, l.pesoOrdem, l.data].join("|");

// Lê todos os arquivos de planilha da lista (pasta escolhida ou arrastada).
// Linhas idênticas que aparecem em mais de um arquivo (exports sobrepostos) são contadas uma vez.
export async function lerPasta(
  files: File[],
  onProgresso?: (feito: number, total: number, arquivo: string) => void,
): Promise<ResumoPasta> {
  const validos = files
    .filter(arquivoValido)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { numeric: true }));
  if (validos.length === 0) throw new Error("Nenhum arquivo .xlsx/.xls encontrado na pasta.");

  const rel = (validos[0] as File & { webkitRelativePath?: string }).webkitRelativePath;
  const nome = rel && rel.includes("/") ? rel.split("/")[0] : `${validos.length} arquivo${validos.length > 1 ? "s" : ""}`;

  const vistas = new Set<string>();
  const linhas: Linha[] = [];
  const lidos: string[] = [];
  const falhas: { arquivo: string; motivo: string }[] = [];
  let duplicadas = 0;

  for (let i = 0; i < validos.length; i++) {
    const f = validos[i];
    onProgresso?.(i, validos.length, f.name);
    try {
      const l = await lerPlanilha(f);
      const novas = new Set<string>();
      for (const x of l) {
        const k = chaveLinha(x);
        if (vistas.has(k)) { duplicadas++; continue; } // já veio de um arquivo anterior
        novas.add(k);
        linhas.push(x);
      }
      for (const k of novas) vistas.add(k);
      lidos.push(f.name);
    } catch (e) {
      falhas.push({ arquivo: f.name, motivo: e instanceof Error ? e.message : "Erro ao ler." });
    }
  }
  onProgresso?.(validos.length, validos.length, "");
  if (lidos.length === 0) throw new Error(`Nenhum arquivo pôde ser lido. ${falhas[0]?.motivo ?? ""}`);
  return { nome, lidos, falhas, duplicadas, linhas };
}

// Arquivos de uma pasta arrastada para a tela (percorre subpastas)
export async function arquivosDoDrop(dt: DataTransfer): Promise<File[]> {
  type Entry = { isFile: boolean; isDirectory: boolean; file?: (cb: (f: File) => void, err: (e: unknown) => void) => void; createReader?: () => { readEntries: (cb: (e: Entry[]) => void, err: (e: unknown) => void) => void } };
  const out: File[] = [];
  const andar = async (en: Entry): Promise<void> => {
    if (en.isFile && en.file) {
      const f = await new Promise<File>((res, rej) => en.file!(res, rej));
      out.push(f);
    } else if (en.isDirectory && en.createReader) {
      const rd = en.createReader();
      for (;;) {
        const lote = await new Promise<Entry[]>((res, rej) => rd.readEntries(res, rej));
        if (lote.length === 0) break;
        for (const x of lote) await andar(x);
      }
    }
  };
  const itens = [...dt.items];
  const entradas = itens.map((i) => (i as DataTransferItem & { webkitGetAsEntry?: () => Entry | null }).webkitGetAsEntry?.() ?? null);
  if (entradas.some((e) => e)) {
    for (const e of entradas) if (e) await andar(e);
  } else {
    out.push(...dt.files);
  }
  return out;
}
