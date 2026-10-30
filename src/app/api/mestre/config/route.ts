import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CHAVES = new Set(["refUP"]);

export async function POST(req: Request) {
  try {
    const b = await req.json();
    const chave = typeof b.chave === "string" ? b.chave : "";
    const valor = typeof b.valor === "string" ? b.valor.slice(0, 200) : "";
    if (!CHAVES.has(chave)) return NextResponse.json({ error: "Chave inválida." }, { status: 400 });
    await prisma.mestreConfig.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Não foi possível salvar a configuração." }, { status: 500 });
  }
}
