export const ESTRUTURAS = ["LT", "SE", "POSTE", "TELECOM", "SOLAR", "OUTROS"];
export const CIRCUITOS = ["CS", "CD"];
export const TIPOS = ["Estaiada", "Suspensão", "Ancoragem"];
export const TIPOS_SOLAR = ["Tracker", "Fixo"];

// Estruturas que aceitam cada campo
export const temKva = (e: string) => e !== "TELECOM" && e !== "SOLAR";
export const temCircuito = (e: string) => e === "LT";
export const temTipo = (e: string) => e === "LT" || e === "SOLAR";
export const tiposDe = (e: string) => (e === "SOLAR" ? TIPOS_SOLAR : e === "LT" ? TIPOS : []);
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
  return [...TIPOS, ...TIPOS_SOLAR].find((x) => semAcento(x) === semAcento(t)) ?? t;
}

// LT: KVA, circuito e tipo (Estaiada/Suspensão/Ancoragem).
// SOLAR: só tipo (Tracker/Fixo), sem KVA nem circuito.
// Demais estruturas: sem circuito nem tipo (TELECOM também sem KVA).
export function aplicarRegraLT<T extends SiglaCampos>(c: T): T {
  const kva = temKva(c.estrutura) ? c.kva : "";
  const circuito = temCircuito(c.estrutura) ? c.circuito : "";
  // tipo de outra estrutura não vale aqui (ex.: "Estaiada" em SOLAR)
  const tipo =
    c.estrutura === "SOLAR" ? (TIPOS_SOLAR.includes(c.tipo) ? c.tipo : "")
    : c.estrutura === "LT" ? (TIPOS_SOLAR.includes(c.tipo) ? "" : c.tipo)
    : "";
  return { ...c, kva, circuito, tipo };
}

export type Status = "pendente" | "incompleto" | "completo";
export function statusDe(c: SiglaCampos): Status {
  if (!c.estrutura) return "pendente";
  if (temKva(c.estrutura) && c.estrutura !== "OUTROS" && !c.kva) return "incompleto";
  if (c.estrutura === "LT" && (!c.circuito || !c.tipo)) return "incompleto";
  if (c.estrutura === "SOLAR" && !c.tipo) return "incompleto";
  return "completo";
}
