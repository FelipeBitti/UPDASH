import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const erro = (msg: string, status = 500) => NextResponse.json({ error: msg }, { status });
const txt = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const numOuNull = (v: unknown): number | null | undefined => {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9 ? v : undefined;
};

export async function GET() {
  try {
    const [linhas, cfg] = await Promise.all([
      prisma.mestreLinha.findMany({
        select: { id: true, produto: true, tensao: true, construtivo: true, rotulo: true, tempoH: true, pesoMedio: true, manual: true },
      }),
      prisma.mestreConfig.findMany(),
    ]);
    return NextResponse.json({ linhas, config: Object.fromEntries(cfg.map((c) => [c.chave, c.valor])) });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível ler a Planilha Mestre.");
  }
}

// Cria ou atualiza uma linha (chave = produto + tensão + tipo construtivo). Só altera os campos enviados.
export async function PUT(req: Request) {
  try {
    const b = await req.json();
    const produto = txt(b.produto, 60);
    const tensao = txt(b.tensao, 20);
    const construtivo = txt(b.construtivo, 30);
    if (!produto) return erro("Produto obrigatório.", 400);

    const dados: { rotulo?: string; tempoH?: number | null; pesoMedio?: number | null } = {};
    if (b.rotulo !== undefined) dados.rotulo = txt(b.rotulo, 80);
    for (const campo of ["tempoH", "pesoMedio"] as const) {
      if (b[campo] === undefined) continue;
      const n = numOuNull(b[campo]);
      if (n === undefined) return erro(`Valor inválido em ${campo}.`, 400);
      dados[campo] = n;
    }

    const linha = await prisma.mestreLinha.upsert({
      where: { produto_tensao_construtivo: { produto, tensao, construtivo } },
      create: { produto, tensao, construtivo, manual: b.manual === true, ...dados },
      update: dados,
      select: { id: true, produto: true, tensao: true, construtivo: true, rotulo: true, tempoH: true, pesoMedio: true, manual: true },
    });
    return NextResponse.json({ linha });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível salvar a linha.");
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return erro("id obrigatório.", 400);
    await prisma.mestreLinha.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível excluir a linha.");
  }
}
