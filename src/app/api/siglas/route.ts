import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const siglas = await prisma.sigla.findMany({
      orderBy: [{ sigla: "asc" }, { cdPai: "asc" }],
      select: { id: true, sigla: true, cdPai: true, estrutura: true, kva: true, circuito: true, tipo: true, observacao: true, origem: true },
    });
    return NextResponse.json({ siglas });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível ler o cadastro de siglas." }, { status: 500 });
  }
}
