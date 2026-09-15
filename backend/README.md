# Termo Politico Backend

Backend do Termometro Popular de Urucuca.

## Stack

- Node.js ESM
- Fastify
- Supabase Postgres
- `node:test` para testes

## Setup

```bash
npm install
cp .env.example .env
npm test
npm run dev
```

Sem variaveis do Supabase, a API sobe com candidatos mockados e votos em memoria para desenvolvimento local.

## Supabase

1. Crie um projeto no Supabase.
2. Rode `supabase/schema.sql` no SQL editor.
3. Preencha `.env`:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
TSE_YEAR=2024
TSE_CITY_CODE=
TSE_ELECTION_ID=
```

Use `SUPABASE_SERVICE_ROLE_KEY` apenas no backend. Nunca exponha essa chave no frontend.

## Sincronizar candidatos

```bash
npm run sync:candidates -- prefeito
npm run sync:candidates -- vereador
```

O site deve ler candidatos do Supabase, nao diretamente do TSE no carregamento da pagina.

## Endpoints

- `GET /health`
- `GET /api/candidates?office=prefeito`
- `POST /api/polls/votes`
- `GET /api/polls/results?office=prefeito`
- `GET /api/campaign-ads`

`POST /api/polls/votes` espera:

```json
{
  "candidateId": "uuid-do-candidato"
}
```

E o header:

```txt
x-voter-fingerprint: hash-tecnico-anonimo
```

Esse hash nao deve conter CPF, nome, titulo de eleitor ou qualquer identificador pessoal explicito.
