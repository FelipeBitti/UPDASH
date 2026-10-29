import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aplicarRegraLT, limpar, normCircuito, normEstrutura, normKva, normTipo } from "@/lib/siglas";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const b = await req.json();
    const atual = await prisma.sigla.findUnique({ where: { id } });
    if (!atual) return NextResponse.json({ error: "Sigla não encontrada." }, { status: 404 });

    const novo = aplicarRegraLT({
      estrutura: b.estrutura !== undefined ? normEstrutura(b.estrutura).slice(0, 40) : atual.estrutura,
      kva: b.kva !== undefined ? normKva(b.kva).slice(0, 40) : atual.kva,
      circuito: b.circuito !== undefined ? normCircuito(b.circuito).slice(0, 40) : atual.circuito,
      tipo: b.tipo !== undefined ? normTipo(b.tipo).slice(0, 40) : atual.tipo,
      observacao: b.observacao !== undefined ? limpar(b.observacao).slice(0, 500) : atual.observacao,
    });
    const sigla = await prisma.sigla.update({
      where: { id },
      data: novo,
      select: { id: true, sigla: true, cdPai: true, estrutura: true, kva: true, circuito: true, tipo: true, observacao: true, origem: true },
    });
    return NextResponse.json({ sigla });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível salvar." }, { status: 500 });
  }
}
