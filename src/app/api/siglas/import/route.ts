import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aplicarRegraLT, limpar, normCircuito, normEstrutura, normKva, normTipo, type SiglaCampos } from "@/lib/siglas";

// Importa linhas de uma planilha de siglas. Cria as novas; nas existentes só preenche campos vazios
// (nunca sobrescreve o que já foi preenchido).
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const bruto: Record<string, unknown>[] = Array.isArray(b.rows) ? b.rows.slice(0, 1000) : [];

    const mapa = new Map<string, { sigla: string; cdPai: string } & SiglaCampos>();
    for (const r of bruto) {
      const sigla = limpar(r.sigla).toUpperCase();
      const cdPai = limpar(r.cdPai);
      if (!sigla || !cdPai || sigla.length > 40 || cdPai.length > 40) continue;
      const campos = aplicarRegraLT({
        estrutura: normEstrutura(r.estrutura).slice(0, 40),
        kva: normKva(r.kva).slice(0, 40),
        circuito: normCircuito(r.circuito).slice(0, 40),
        tipo: normTipo(r.tipo).slice(0, 40),
        observacao: limpar(r.observacao).slice(0, 500),
      });
      mapa.set(`${sigla}|${cdPai}`, { sigla, cdPai, ...campos });
    }
    const itens = [...mapa.values()];
    if (!itens.length) return NextResponse.json({ criadas: 0, atualizadas: 0 });

    const existentes = await prisma.sigla.findMany({ where: { cdPai: { in: [...new Set(itens.map((i) => i.cdPai))] } } });
    const porChave = new Map(existentes.map((e) => [`${e.sigla}|${e.cdPai}`, e]));

    const novos: typeof itens = [];
    const updates = [];
    const campos = ["estrutura", "kva", "circuito", "tipo", "observacao"] as const;
    for (const it of itens) {
      const e = porChave.get(`${it.sigla}|${it.cdPai}`);
      if (!e) {
        novos.push(it);
        continue;
      }
      const patch: Partial<SiglaCampos> = {};
      for (const c of campos) if (!e[c] && it[c]) patch[c] = it[c];
      const final = aplicarRegraLT({ ...e, ...patch });
      if (final.kva !== (patch.kva ?? e.kva)) delete patch.kva;
      if (final.circuito !== (patch.circuito ?? e.circuito)) delete patch.circuito;
      if (final.tipo !== (patch.tipo ?? e.tipo)) delete patch.tipo;
      if (Object.keys(patch).length) updates.push(prisma.sigla.update({ where: { id: e.id }, data: patch }));
    }
    if (novos.length) await prisma.sigla.createMany({ data: novos.map((n) => ({ ...n, origem: "planilha" })), skipDuplicates: true });
    if (updates.length) await prisma.$transaction(updates);
    return NextResponse.json({ criadas: novos.length, atualizadas: updates.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível importar as siglas." }, { status: 500 });
  }
}
