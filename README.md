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

Projeto: `tesouro_epa_db` (região eu-west-3, Paris).

### Estrutura

O esquema está **todo** em migrações SQL em `supabase/migrations/` (nada é criado à mão):

| Migração | Conteúdo |
|---|---|
| `*_schema.sql` | Tabelas, índices, funções auxiliares e **RLS em todas as tabelas** |
| `*_functions.sql` | Funções RPC (entrar na equipa, quiz, submissões, validação, classificação, administração) |
| `*_storage_realtime.sql` | Bucket privado `photos` com políticas por equipa e publicação Realtime |
| `*_seed_test_event.sql` | Evento de teste, 7 postos, perguntas e 3 equipas de teste |

Modelo de segurança:

- Os alunos entram com **sessão anónima** (sem email nem nome) e ficam ligados à equipa pela função `join_team(code)`.
- Cada equipa só lê os seus dados. As equipas **nunca escrevem diretamente** em tabelas: tudo passa por funções RPC que validam os dados.
- A resposta certa do quiz está em `private.quiz_keys`, um schema que **não é exposto** pela API. `submit_quiz_answer` devolve apenas certo/errado.
- A distância ao posto e o "fora da área" são calculados **no servidor** (`create_submission`).
- Só professores (tabela `staff`) validam, pontuam e gerem equipas. Só o papel `admin` apaga dados.
- Fotos em `photos/<event_id>/<team_id>/<checkpoint_id>/<timestamp>.jpg`; cada equipa só carrega e vê a sua pasta.

### Aplicar as migrações num projeto novo

```bash
npx supabase login
npx supabase link --project-ref <ref-do-projeto>
npx supabase db push
```

### Teste de segurança (RLS)

`supabase/tests/rls_test.sql` simula alunos de equipas diferentes, uma sessão sem equipa e um professor, e verifica o que cada um pode ver e fazer. Corre dentro de uma transação que é desfeita no fim (não deixa dados).

Supabase → **SQL Editor** → colar o ficheiro → **Run**. Resultado esperado: `TODOS OS TESTES PASSARAM`.

### Configuração no painel do Supabase

1. **Authentication → Sign In / Providers → Anonymous Sign-Ins**: ativar.
2. **Authentication → Sign In / Providers → Email**: manter ativo, mas **desligar "Allow new users to sign up"** (as contas de professor são criadas pelo admin).
3. **Authentication → URL Configuration**: Site URL = endereço da app publicada; acrescentar `http://localhost:8080` às Redirect URLs.
4. **Criar o primeiro admin**:
   - Authentication → Users → **Add user** → email e palavra-passe do professor (marcar "Auto Confirm User").
   - SQL Editor:
     ```sql
     insert into public.staff (user_id, name, role)
     select id, 'Nome do Professor', 'admin' from auth.users where email = 'email@exemplo.pt';
     ```
   - Os restantes professores podem depois ser adicionados no painel da app.

### Dados de teste

| Código | Equipa | Posto inicial |
|---|---|---|
| `EPA-TST1` | Equipa Teste 1 | 1 |
| `EPA-TST2` | Equipa Teste 2 | 4 |
| `EPA-TST3` | Equipa Teste 3 | 6 |

O evento de teste tem hora limite a 31/12/2026, para não gerar penalizações de atraso durante os testes.

### Regenerar os tipos TypeScript

```bash
npx supabase gen types typescript --project-id imryfgenvpcjhdsthidg > src/integrations/supabase/types.ts
```

> **Plano gratuito:** o Supabase pausa projetos sem atividade durante cerca de uma semana. Se a app deixar de responder, entrar no painel do Supabase e carregar em **Restore project**.

## Testar a app das equipas

```bash
npm run dev
```

1. Abrir http://localhost:8080 e entrar com o código `EPA-TST2` ou `EPA-TST3` (a `EPA-TST1` já tem submissões de teste).
2. Aceitar o aviso de privacidade → ecrã inicial com cronómetro, pontuação, próximo posto e lista dos 7 postos.
3. Abrir um posto → **Tirar fotografia** → escrever a resposta → **Enviar desafio**.
4. Responder à pergunta (uma única tentativa).
5. Testar sem rede: nas DevTools do Chrome (F12 → Network → **Offline**) enviar uma foto; aparece "A aguardar envio". Voltar a **Online**: é enviada sozinha.

### No telemóvel (câmara e GPS)

O GPS só funciona em HTTPS (ou em `localhost`). Para testar num telemóvel ligado à **mesma rede Wi-Fi**:

```bash
npm run dev:telemovel
```

Abrir no telemóvel o endereço `https://…:8080` indicado como **Network**. O browser avisa que o certificado não é de confiança (é local): escolher "Avançadas" → "Continuar".

## Pontuação

| Item | Pontos |
|---|---|
| Quiz certo | 10 por posto (máx. 70) |
| Desafio validado | 0–15 por posto: 5 foto + 5 pertinência + 5 frase (máx. 105) |
| Trabalho de equipa | 0–15 |
| Apresentação final | 0–10 |
| Atraso | −5 por cada bloco de 5 min começado após a hora limite |
| Regra de segurança não cumprida | −10 cada |

Desempate: mais desafios validados → mais pontos de trabalho de equipa → chegada mais cedo.

_As secções de deploy serão completadas nas próximas fases._
