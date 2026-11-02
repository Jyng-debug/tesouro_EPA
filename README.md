# Tesouro EPA — Caça ao Tesouro da Cidadania

Web app (PWA) mobile-first para a atividade **Caça ao Tesouro da Cidadania** da Escola Profissional de Aveiro (EPA).

- **App das equipas** (telemóvel): entrar com o código da equipa, mapa dos 7 postos, fotografia + desafio + quiz em cada posto, funciona com rede fraca.
- **Painel dos professores**: gestão de equipas, validação das fotografias em tempo real, pontuação, classificação, galeria e exportação.

## Stack

React 18 + Vite + TypeScript · Tailwind CSS + shadcn/ui · React Router · TanStack Query · Supabase (Postgres, Auth, Storage, Realtime) · Leaflet + OpenStreetMap · vite-plugin-pwa.

## Instalação (desenvolvimento)

Requisitos: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env.local   # preencher com os valores do Supabase
npm run dev                  # http://localhost:8080
```

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Compilação para produção (pasta `dist/`) |
| `npm run preview` | Pré-visualizar a compilação |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) |

## Variáveis de ambiente

| Variável | Onde obter |
|---|---|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → chave `anon` / publishable |

> A chave `service_role` **nunca** é usada no frontend nem guardada no repositório.

## Supabase

O esquema da base de dados está em `supabase/migrations/` (ver Fase 1).

_Secções de configuração do Supabase, testes e deploy serão completadas nas próximas fases._
