// Vercel Serverless Function — Express handler
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

const app = express();
app.set("trust proxy", 1);

app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api") || req.path.startsWith("/objects")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

const httpServer = createServer(app);
let initPromise: Promise<any> | null = null;
let initError: any = null;

function initialize() {
  if (initPromise) return initPromise;
  
  initPromise = registerRoutes(httpServer, app).catch((err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("Failed to register routes:", errorMessage);
    initError = err;
    throw err;
  });
  
  return initPromise;
}

// Global error handler for the app
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const errorObj = err instanceof Error ? err : { message: String(err) };
  const status = (err as any)?.status || (err as any)?.statusCode || 500;
  const message = errorObj.message || "Internal Server Error";
  const stack = errorObj instanceof Error ? errorObj.stack : undefined;
  res.status(status).json({ message, stack });
});

export default async function (req: Request, res: Response) {
  try {
    await initialize();
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    return res.status(500).json({
      error: "Initialization error",
      message: errorMessage,
      stack: errorStack
    });
  }

  if (initError) {
    const errorMessage = initError instanceof Error ? initError.message : String(initError);
    const errorStack = initError instanceof Error ? initError.stack : undefined;
    return res.status(500).json({
      error: "Initialization error",
      message: errorMessage,
      stack: errorStack
    });
  }

  return app(req, res);
}
