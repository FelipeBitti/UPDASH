import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limpar } from "@/lib/siglas";

// Registra pares (sigla, CD pai) novos vindos da planilha de produção. Não altera os já existentes.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const lista: unknown[] = Array.isArray(b.pares) ? b.pares.slice(0, 5000) : [];
    const vistos = new Set<string>();
    const data: { sigla: string; cdPai: string; origem: string }[] = [];
    for (const p of lista as { sigla?: unknown; cdPai?: unknown }[]) {
      const sigla = limpar(p?.sigla).toUpperCase();
      const cdPai = limpar(p?.cdPai);
      if (!sigla || !cdPai || sigla.length > 40 || cdPai.length > 40) continue;
      const k = `${sigla}|${cdPai}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      data.push({ sigla, cdPai, origem: "auto" });
    }
    const r = data.length ? await prisma.sigla.createMany({ data, skipDuplicates: true }) : { count: 0 };
    return NextResponse.json({ criadas: r.count });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível registrar as novas siglas." }, { status: 500 });
  }
}
