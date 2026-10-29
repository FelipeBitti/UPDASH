# Dashboard de Produção

Lê a planilha de operações/ordens de produção (Excel), extrai **sigla** e **código** do campo *Texto breve Material*
e mostra KPIs, gráficos e tabela. O que não for reconhecido vai para a aba **Pendências**: você indica qual palavra é a
sigla e qual é o código, a regra é salva no banco (Neon) e vale para todos os textos de mesmo formato nas próximas planilhas.

- Extração automática: código de 10 dígitos (prefere `6000xxxxxx`) e a sigla é a palavra logo antes dele.
  Ex.: `POS 163H E51SM 6000155040 TORRE` → sigla `E51SM`, código `6000155040`.
- A planilha é lida no navegador (não passa pela Vercel); só as regras vão para o banco.

## Rodar local
```bash
npm install
cp .env.example .env      # preencha DATABASE_URL e DIRECT_URL (Neon)
npm run db:push           # cria a tabela de regras
npm run dev
```

## Publicar (GitHub → Vercel + Neon)
1. **Neon**: crie o projeto e copie as duas strings de conexão (*pooled* → `DATABASE_URL`, *direct* → `DIRECT_URL`).
2. **GitHub**: `git init && git add . && git commit -m "dashboard" ` e envie para um repositório.
3. **Vercel**: *Add New → Project* → importe o repositório → em *Environment Variables* adicione
   `DATABASE_URL` e `DIRECT_URL` (e, se quiser proteger o site, `BASIC_AUTH_USER` / `BASIC_AUTH_PASS`) → *Deploy*.
   O build roda `prisma db push` e cria a tabela automaticamente.

## Colunas esperadas na planilha
Ordem de Produção, Texto breve Material, Txt.breve operacao, Centro de trabalho, Qtd.boa total,
Peso Qtd.boa total confirmada, Peso Ordem, Data Entrada.

## Cadastro de siglas (aba "Siglas e CD pai")
- Todo par **sigla + CD pai** novo que aparece numa planilha de produção é cadastrado sozinho.
- Preencha Estrutura (LT, SE, POSTE, TELECOM), KVA e Observação; Circuito (CS/CD) e Tipo (Estaiada/Suspensão/Ancoragem) só para LT.
- "Importar planilha de siglas" carrega um Excel no formato `SIGLA | CD PAI | Estrutura | KVA | Circuito | TIPO | Observação`
  (cria as novas e só completa campos vazios das existentes). "Exportar Excel" baixa o cadastro no mesmo formato.
