// Extração de SIGLA e CÓDIGO a partir do "Texto breve Material".
// Ex.: "POS 163H E51SM 6000155040 TORRE" -> sigla E51SM, código 6000155040

export type Regra = {
  id: string;
  padrao: string;
  indiceSigla: number | null;
  indiceCodigo: number | null;
  exemplo: string;
};

export type Origem = "regra" | "auto" | "ignorado" | "pendente";

export type Resultado = {
  sigla: string | null;
  codigo: string | null;
  origem: Origem;
  tokens: string[];
  padrao: string;
  // sugestões (posição dos tokens) para pré-preencher a tela de pendências
  sugSigla: number | null;
  sugCodigo: number | null;
};

const STOP = new Set(["POS", "TORRE", "POSTE", "PORTICO", "CJ", "SOLD", "MOD", "UN"]);

export function tokenizar(texto: string): string[] {
  return texto
    .toUpperCase()
    .split(/\s+/)
    .map((t) => t.replace(/^[(),;:]+|[(),;:]+$/g, ""))
    .filter(Boolean);
}

// "#" = só dígitos, "@" = mistura de letras/dígitos, senão o próprio texto (palavra fixa)
export function formaToken(t: string): string {
  if (/^\d+$/.test(t)) return "#";
  if (/\d/.test(t)) return "@";
  return t;
}

export function padraoDe(tokens: string[]): string {
  return tokens.map(formaToken).join(" ");
}

// Padrão para salvar: as posições escolhidas viram curinga "*"
export function padraoParaRegra(tokens: string[], idxSigla: number | null, idxCodigo: number | null): string {
  return tokens.map((t, i) => (i === idxSigla || i === idxCodigo ? "*" : formaToken(t))).join(" ");
}

function acharCodigo(tokens: string[]): number {
  let i = tokens.findIndex((t) => /^6000\d{6}$/.test(t));
  if (i < 0) i = tokens.findIndex((t) => /^\d{10}$/.test(t));
  return i;
}

function siglaAntesDoCodigo(tokens: string[], iCod: number): number | null {
  const i = iCod - 1;
  if (i < 0) return null;
  const t = tokens[i];
  if (!/[A-Z]/.test(t) || t.length < 2 || t.length > 10 || STOP.has(t)) return null;
  return i;
}

type RegraPreparada = { regra: Regra; pad: string[]; especificidade: number };

export function criarExtrator(regras: Regra[]) {
  const porTamanho = new Map<number, RegraPreparada[]>();
  for (const regra of regras) {
    const pad = regra.padrao.split(" ");
    const lista = porTamanho.get(pad.length) ?? [];
    lista.push({ regra, pad, especificidade: pad.filter((p) => p !== "*").length });
    porTamanho.set(pad.length, lista);
  }
  for (const l of porTamanho.values()) l.sort((a, b) => b.especificidade - a.especificidade);

  const cache = new Map<string, Resultado>();

  return function extrair(texto: string): Resultado {
    const chave = texto ?? "";
    const hit = cache.get(chave);
    if (hit) return hit;

    const tokens = tokenizar(chave);
    const padrao = padraoDe(tokens);
    const base = { tokens, padrao, sugSigla: null as number | null, sugCodigo: null as number | null };
    let res: Resultado;

    if (tokens.length === 0) {
      res = { ...base, sigla: null, codigo: null, origem: "ignorado" };
    } else {
      // 1) regras aprendidas (têm prioridade)
      const candidatas = porTamanho.get(tokens.length) ?? [];
      const achada = candidatas.find((c) => c.pad.every((p, i) => p === "*" || p === formaToken(tokens[i])));
      if (achada) {
        const { indiceSigla: s, indiceCodigo: c } = achada.regra;
        res =
          s === null && c === null
            ? { ...base, sigla: null, codigo: null, origem: "ignorado" }
            : {
                ...base,
                sigla: s !== null ? tokens[s] ?? null : null,
                codigo: c !== null ? tokens[c] ?? null : null,
                origem: "regra",
              };
      } else {
        // 2) extração automática: código de 10 dígitos e a sigla logo antes dele
        const iCod = acharCodigo(tokens);
        const iSig = iCod >= 0 ? siglaAntesDoCodigo(tokens, iCod) : null;
        if (iCod >= 0 && iSig !== null) {
          res = { ...base, sigla: tokens[iSig], codigo: tokens[iCod], origem: "auto", sugSigla: iSig, sugCodigo: iCod };
        } else {
          res = {
            ...base,
            sigla: null,
            codigo: null,
            origem: "pendente",
            sugSigla: iSig,
            sugCodigo: iCod >= 0 ? iCod : null,
          };
        }
      }
    }
    cache.set(chave, res);
    return res;
  };
}
