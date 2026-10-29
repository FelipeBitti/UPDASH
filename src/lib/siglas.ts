export const ESTRUTURAS = ["LT", "SE", "POSTE", "TELECOM"];
export const CIRCUITOS = ["CS", "CD"];
export const TIPOS = ["Estaiada", "Suspensão", "Ancoragem"];
export const KVAS = ["13,8KV", "34,5KV", "69KV", "138KV", "500KV", "525KV", "800KV"];

export type SiglaCampos = {
  estrutura: string;
  kva: string;
  circuito: string;
  tipo: string;
  observacao: string;
};

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export const limpar = (v: unknown) => String(v ?? "").trim();
export const normEstrutura = (v: unknown) => limpar(v).toUpperCase();
export const normKva = (v: unknown) => limpar(v).toUpperCase().replace(/\s+/g, "");
export const normCircuito = (v: unknown) => limpar(v).toUpperCase();
export function normTipo(v: unknown) {
  const t = limpar(v);
  return TIPOS.find((x) => semAcento(x) === semAcento(t)) ?? t;
}

// Só estrutura LT tem circuito e tipo
export function aplicarRegraLT<T extends SiglaCampos>(c: T): T {
  return c.estrutura === "LT" ? c : { ...c, circuito: "", tipo: "" };
}

export type Status = "pendente" | "incompleto" | "completo";
export function statusDe(c: SiglaCampos): Status {
  if (!c.estrutura) return "pendente";
  if (c.estrutura !== "TELECOM" && !c.kva) return "incompleto";
  if (c.estrutura === "LT" && (!c.circuito || !c.tipo)) return "incompleto";
  return "completo";
}
