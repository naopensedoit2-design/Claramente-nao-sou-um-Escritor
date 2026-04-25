# Claramente não sou um Escritor

Blog de crônicas com assistente de IA "Jarbas" — gerado no Replit AI, pronto para deploy no Vercel.

## 🚀 Deploy no Vercel

### Pré-requisitos

Antes de fazer o deploy, você precisa:

1. **Banco de dados PostgreSQL** — Recomendados gratuitos:
   - [Neon](https://neon.tech) — serverless Postgres, ideal para Vercel
   - [Supabase](https://supabase.com) — alternativa popular

2. **Chave OpenAI** — Para o assistente "Jarbas" (sugestões de texto)
   - Crie em: https://platform.openai.com/api-keys

3. **Chave Google Gemini** — Para transcrição de áudio
   - Crie em: https://aistudio.google.com/app/apikey

---

### Passo a Passo

#### 1. Import no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Clique em **"Add New Project"**
3. Conecte sua conta GitHub e selecione o repositório `Claramente-nao-sou-um-Escritor`
4. O Vercel vai detectar automaticamente as configurações do `vercel.json`

#### 2. Configure as Variáveis de Ambiente

Na tela de configuração do projeto (antes de fazer o deploy), adicione as seguintes variáveis em **"Environment Variables"**:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL de conexão PostgreSQL (ex: Neon) |
| `SESSION_SECRET` | String aleatória longa para segurança das sessões |
| `ADMIN_PASSWORD` | Senha para acessar o painel de admin |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Chave API da OpenAI |
| `OPENAI_API_KEY` | Mesma chave (alias) |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Chave API do Google Gemini |

> Veja `.env.example` para mais detalhes sobre cada variável.

#### 3. Inicialize o Banco de Dados

Após o primeiro deploy, execute o seguinte comando localmente para criar as tabelas:

```bash
# Instale as dependências primeiro
npm install

# Configure o DATABASE_URL no seu ambiente local
# (copie .env.example para .env.local e preencha)

# Crie as tabelas no banco
npm run db:push
```

#### 4. Clique em "Deploy"

O Vercel vai:
1. Fazer o build do frontend React com Vite
2. Configurar a API Express como serverless function
3. Fornecer uma URL pública para o seu blog

---

## 🛠️ Desenvolvimento Local

```bash
# Instale as dependências
npm install

# Copie e configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com suas credenciais

# Inicialize o banco de dados
npm run db:push

# Inicie o servidor de desenvolvimento
npm run dev
```

O app estará disponível em `http://localhost:5000`.

---

## 📁 Estrutura do Projeto

```
├── client/          # Frontend React
│   └── src/
│       ├── components/
│       └── pages/
├── server/          # Backend Express
│   ├── index.ts     # Entry point (exporta `app` para Vercel)
│   ├── routes.ts    # Rotas da API
│   ├── storage.ts   # Camada de dados
│   └── db.ts        # Conexão PostgreSQL
├── shared/          # Tipos e schema compartilhados
│   ├── schema.ts    # Schema Drizzle ORM
│   └── routes.ts    # Definição tipada das rotas
├── api/
│   └── index.ts     # Serverless function entry (Vercel)
├── vercel.json      # Configuração do Vercel
└── .env.example     # Template de variáveis de ambiente
```

---

## ⚙️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Radix UI
- **Backend**: Express.js, Node.js
- **Banco de dados**: PostgreSQL + Drizzle ORM
- **IA**: OpenAI GPT-4o (texto) + Google Gemini (áudio)
- **Deploy**: Vercel (serverless)

---

## 📝 Funcionalidades

- **Blog público** — Exibe as crônicas visíveis para todos os visitantes
- **Painel Admin** — Acesso protegido por senha para criar/editar/deletar posts
- **Jarbas** — Assistente de IA que sugere e melhora crônicas
- **Transcrição de áudio** — Grave e converta para texto com Google Gemini
