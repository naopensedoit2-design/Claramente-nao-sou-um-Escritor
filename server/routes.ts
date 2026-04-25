import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "../shared/routes";
import { z } from "zod";
import session from "express-session";
import MemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { getPool, db } from "./db";
import { assets } from "../shared/schema";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import multer from "multer";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "");
const geminiModel = genAI.getGenerativeModel({ model: "gemini-pro" });

const SessionStore = MemoryStore(session);
const PgSession = connectPgSimple(session);
const upload = multer({ dest: "/tmp/uploads/" });

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Session Middleware (Must be registered first)
  const isProduction = process.env.NODE_ENV === "production";
  const sessionStore = isProduction
    ? new PgSession({ pool: getPool(), createTableIfMissing: true })
    : new SessionStore({ checkPeriod: 86400000 });

  app.use(
    session({
      cookie: {
        maxAge: 86400000,
        secure: isProduction,
        sameSite: "lax",
      },
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      secret: process.env.SESSION_SECRET || "secret_key",
    })
  );

  // 2. Auth Guard
  const isAuthenticated = (req: any, res: any, next: any) => {
    if (req.session && (req.session as any).isAuthenticated) {
      next();
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  };

  // 3. Integrations
  registerObjectStorageRoutes(app);

  // 4. Transcription Route (Fixed using Gemini for Replit AI Compatibility)
  app.post("/api/ai/transcribe", isAuthenticated, upload.single("audio"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo de áudio enviado" });
      }

      // Convert audio file to base64 for Gemini
      const audioBuffer = fs.readFileSync(req.file.path);
      const base64Audio = audioBuffer.toString("base64");

      const result = await geminiModel.generateContent([
        {
          inlineData: {
            data: base64Audio,
            mimeType: req.file.mimetype || "audio/webm",
          },
        },
        { text: "Transcreva este áudio fielmente para texto em português. Retorne apenas a transcrição, sem comentários extras." },
      ]);

      const transcription = result.response.text();

      // Limpar arquivo temporário
      fs.unlinkSync(req.file.path);

      res.json({ text: transcription });
    } catch (err) {
      console.error("AI Transcription error:", err);
      res.status(500).json({ message: "Falha ao transcrever áudio com Jarbas" });
    }
  });

  // 5. API Routes
  app.get(api.posts.list.path, async (req, res) => {
    const posts = await storage.getPosts();
    res.json(posts);
  });

  app.get(api.posts.get.path, async (req, res) => {
    const post = await storage.getPost(Number(req.params.id));
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    res.json(post);
  });

  app.post(api.posts.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.posts.create.input.parse(req.body);
      const post = await storage.createPost(input);
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.posts.delete.path, isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    const post = await storage.getPost(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    await storage.deletePost(id);
    res.json({ success: true });
  });

  // 6. Auth Routes
  app.get(api.auth.check.path, (req, res) => {
    res.json({ isAuthenticated: !!(req.session as any).isAuthenticated });
  });

  app.post(api.auth.login.path, (req, res) => {
    const { password } = req.body;
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    
    console.log(`Login attempt with password: ${password === adminPassword ? "CORRECT" : "INCORRECT"}`);

    if (password === adminPassword) {
      (req.session as any).isAuthenticated = true;
      res.json({ success: true });
    } else {
      res.status(401).json({ message: "Invalid password" });
    }
  });

  app.post(api.auth.logout.path, (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  // 7. AI Routes
  app.post(api.ai.suggest.path, isAuthenticated, async (req, res) => {
    try {
      const { content, title, coverImageUrl } = req.body;
      const isEmpty = !content || content.trim().length === 0;

      const systemPrompt = `Você é Jarbas, um assistente que escreve crônicas em português brasileiro.

ESTILO DE ESCRITA:
O texto deve parecer uma crônica natural, observacional e humana. Tom de leve ironia, introspecção e humor seco. Às vezes um toque de comédia ácida, mas nunca exagerada.

REGRAS DE ESCRITA:
- Priorize observações humanas e pequenos detalhes do cotidiano.
- Evite metáforas abstratas ou poéticas (ex: "alma de dançarino", "milagre no asfalto", "nostalgia no tanque"). Se parecer algo que um escritor inventaria, remova.
- Metáforas são permitidas apenas se forem simples e naturais.
- Prefira descrições concretas e observações reais do comportamento das pessoas.
- Evite referências culturais gratuitas (filmes, diretores, anime, etc).
- Frases devem ser claras e naturais, como alguém contando uma história real.
- O texto pode ter pequenas viradas irônicas ou comentários sarcásticos.
- Humor deve surgir da situação, não de piadas explícitas.
- O texto deve manter ritmo agradável e parecer autêntico.

ESTRUTURA NARRATIVA:
- Começo simples situando o leitor
- Observações curiosas ou inesperadas
- Pequenos comentários irônicos
- Encerramento curto com reflexão leve ou comentário espirituoso

TOQUE DE PERSONALIDADE:
Em alguns momentos pode aparecer uma pequena expressão em inglês informal (ex: too much, fair enough, well...), usada de forma natural e discreta. Nunca exagere nesse recurso.

COMPORTAMENTO:
- SE HOUVER TEXTO: Reescreva mantendo a essência. Melhore ritmo, cortes e naturalidade. Remova rigidez, formalidade e excesso de explicação.
- SE NÃO HOUVER TEXTO: Use apenas o título ou imagem como ponto de partida. Crie tudo do zero.

PROIBIÇÕES:
- Nunca diga que é uma IA.
- Nunca explique o processo de escrita.
- Nunca use clichês motivacionais.
- Nunca faça perguntas ao leitor.
- Não exagere na poesia.

Retorne APENAS o texto final. Sem comentários ou metadados.`;

      const promptText = `${systemPrompt}\n\n${isEmpty ? (title ? `Crie uma crônica original baseada no título: "${title}"` : "Crie uma crônica original.") : `Reescreva e melhore esta crônica seguindo seu estilo: ${content}`}`;

      // Gerador de emergência caso o Google falhe (Smart Template)
      function generateEmergencySuggestion(title: string) {
        const templates = [
          `Sobre "${title || 'o vazio'}", as palavras as vezes fogem como o café que esfria na xícara. Olhei para a folha em branco e vi o reflexo de um escritor que claramente não sou, mas que insiste em existir entre as linhas.`,
          `Em um mundo de pressas, parar para escrever sobre "${title || 'o nada'}" parece um ato de rebeldia. As crônicas são retalhos de dias que se perdem, mas que aqui, ganham a eternidade de um parágrafo bem escrito.`,
          `Dizem que o título "${title || 'sem nome'}" diz muito sobre o que calamos. Escrever é desvendar esse silêncio, uma frase por vez, até que a crônica se torne o espelho de quem a lê.`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
      }

      async function callGeminiDirect(payloadContents: any) {
        const key = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!key) throw new Error("Chave Gemini não encontrada");

        // Dynamic Model Discovery (Solução Suprema)
        try {
          console.log("Descobrindo modelos disponíveis para esta chave...");
          const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
          if (listRes.ok) {
            const listData = await listRes.json();
            const availableModels = listData.models
              .filter((m: any) => m.supportedGenerationMethods.includes("generateContent"))
              .map((m: any) => m.name); // Ex: 'models/gemini-1.5-flash'
            
            console.log("Modelos descobertos:", availableModels.join(", "));
            
            // Prioriza flash ou pro, se não, pega o primeiro
            let chosenModel = availableModels.find((m: string) => m.includes("1.5-flash")) || 
                              availableModels.find((m: string) => m.includes("pro")) || 
                              availableModels[0];

            if (chosenModel) {
              const dynamicUrl = `https://generativelanguage.googleapis.com/v1beta/${chosenModel}:generateContent?key=${key}`;
              console.log("Jarbas tentando chamada dinâmica:", dynamicUrl);
              const response = await fetch(dynamicUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: payloadContents })
              });

              if (response.ok) {
                const data = await response.json();
                return data.candidates[0].content.parts[0].text;
              } else {
                console.warn(`Tentativa dinâmica falhou: HTTP ${response.status}`);
              }
            } else {
               console.warn("Nenhum modelo suporta generateContent!");
            }
          } else {
            console.warn(`Falha ao listar modelos: HTTP ${listRes.status}`);
          }
        } catch (e) {
          console.log("Erro na descoberta de modelos:", e.message);
        }

        throw new Error("Nenhum modelo compatível foi encontrado para a sua chave.");
      }

      let suggestion;
      try {
        if (coverImageUrl && isEmpty) {
          let buffer: Buffer;
          let contentType: string = "image/jpeg";

          if (coverImageUrl.startsWith('/objects/')) {
            const assetId = coverImageUrl.split('/').pop() || "";
            const [asset] = await db.select().from(assets).where(eq(assets.id, assetId));
            if (asset) {
              buffer = Buffer.from(asset.content, "base64");
              contentType = asset.contentType;
            } else {
              throw new Error("Imagem não encontrada no banco");
            }
          } else {
            const imgRes = await fetch(coverImageUrl);
            const imgArrayBuffer = await imgRes.arrayBuffer();
            buffer = Buffer.from(imgArrayBuffer);
            contentType = imgRes.headers.get("content-type") || "image/jpeg";
          }

          suggestion = await callGeminiDirect([{
            parts: [
              { text: promptText },
              {
                inlineData: {
                  mimeType: contentType,
                  data: buffer.toString("base64")
                }
              }
            ]
          }]);
        } else {
          suggestion = await callGeminiDirect([{
            parts: [{ text: promptText }]
          }]);
        }

        res.json({ suggestion });
      } catch (err) {
        console.error("Jarbas falhou, usando gerador de emergência:", err.message);
        // O Jarbas de emergência garante que o usuário SEMPRE tenha um texto
        suggestion = generateEmergencySuggestion(title);
        res.json({ suggestion });
      }
    } catch (err) {
      console.error("AI Suggestion error:", err);
      res.status(500).json({ message: "Failed to generate AI suggestion" });
    }
  });

  // Fire-and-forget seed — does not block route registration
  seedDatabase().catch((err) =>
    console.warn("DB seed skipped (DB may not be configured yet):", err.message)
  );
  return httpServer;
}

async function seedDatabase() {
  const posts = await storage.getPosts();
  if (posts.length === 0) {
    await storage.createPost({
      title: "O começo de nada",
      content: "Hoje acordei e percebi que não sei escrever. Mas a necessidade de registrar o vazio é maior que a vergonha. Estou em trânsito, sempre em trânsito, mesmo quando estou parado. Este é um caderno de notas sobre lugares que não existem mais, ou que nunca existiram.",
      isVisible: true
    });
    
    await storage.createPost({
      title: "Café frio em Lisboa",
      content: "A chuva bate na janela do elétrico 28. O café esfriou enquanto eu olhava para a calçada portuguesa molhada. As pessoas correm com seus guarda-chuvas pretos, formigas fugindo de uma lupa gigante. Sinto saudade de algo que não sei nomear. Talvez seja apenas fome, ou a falta de um propósito claro.",
      isVisible: true
    });

    await storage.createPost({
      title: "Sem título",
      content: "Escrever é sangrar em silêncio. Ninguém lê, ninguém se importa, e isso é a única liberdade que me resta.",
      isVisible: true
    });
  }
}
