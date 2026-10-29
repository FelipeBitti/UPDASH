export type SiglaImport = {
  sigla: string;
  cdPai: string;
  estrutura: string;
  kva: string;
  circuito: string;
  tipo: string;
  observacao: string;
};

const norm = (s: unknown) =>
  String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export async function lerSiglas(file: File): Promise<SiglaImport[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const m = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });

  const h = m.slice(0, 15).findIndex((r) => r.some((c) => norm(c) === "sigla") && r.some((c) => norm(c) === "cd pai"));
  if (h < 0) throw new Error('Colunas "SIGLA" e "CD PAI" não encontradas na planilha.');
  const head = m[h].map(norm);
  const ix = (n: string) => head.indexOf(n);
  const c = {
    sigla: ix("sigla"), cdPai: ix("cd pai"), estrutura: ix("estrutura"), kva: ix("kva"),
    circuito: ix("circuito"), tipo: ix("tipo"), observacao: ix("observacao"),
  };
  const v = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");

  const out: SiglaImport[] = [];
  for (let i = h + 1; i < m.length; i++) {
    const r = m[i];
    const sigla = v(r, c.sigla);
    const cdPai = v(r, c.cdPai);
    if (!sigla || !cdPai) continue;
    out.push({
      sigla, cdPai, estrutura: v(r, c.estrutura), kva: v(r, c.kva),
      circuito: v(r, c.circuito), tipo: v(r, c.tipo), observacao: v(r, c.observacao),
    });
  }
  return out;
}
