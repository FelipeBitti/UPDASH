import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const erro = (msg: string, status = 500) => NextResponse.json({ error: msg }, { status });
const idxOk = (v: unknown) => v === null || v === undefined || (Number.isInteger(v) && (v as number) >= 0 && (v as number) < 100);

export async function GET() {
  try {
    const regras = await prisma.regraExtracao.findMany({ orderBy: { criadoEm: "desc" } });
    return NextResponse.json({ regras });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível ler o banco de dados. Verifique DATABASE_URL e rode `npx prisma db push`.");
  }
}

// Cria ou atualiza a regra de um padrão
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const padrao = typeof b.padrao === "string" ? b.padrao.trim() : "";
    const exemplo = typeof b.exemplo === "string" ? b.exemplo.slice(0, 500) : "";
    if (!padrao || padrao.length > 500) return erro("Padrão inválido.", 400);
    if (!idxOk(b.indiceSigla) || !idxOk(b.indiceCodigo)) return erro("Posição inválida.", 400);

    const dados = { indiceSigla: b.indiceSigla ?? null, indiceCodigo: b.indiceCodigo ?? null, exemplo };
    const regra = await prisma.regraExtracao.upsert({
      where: { padrao },
      create: { padrao, ...dados },
      update: dados,
    });
    return NextResponse.json({ regra });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível salvar a regra.");
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return erro("id obrigatório.", 400);
    await prisma.regraExtracao.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return erro("Não foi possível excluir a regra.");
  }
}
