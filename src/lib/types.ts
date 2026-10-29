import type { Origem } from "./extract";

export type Linha = {
  ordem: string;
  texto: string;
  operacao: string;
  centroTrabalho: string;
  qtdBoa: number;
  pesoConf: number;
  pesoOrdem: number;
  data: string; // yyyy-mm-dd ou ""
};

export type LinhaX = Linha & {
  sigla: string; // "(sem sigla)" quando não houver
  codigo: string; // "—" quando não houver
  origem: Origem;
};
