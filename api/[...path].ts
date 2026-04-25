// Vercel Serverless Function — Express handler
import express, { type Request, type Response, type NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

const app = express();

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
  
  initPromise = registerRoutes(httpServer, app).catch((err) => {
    console.error("Failed to register routes:", err);
    initError = err;
    throw err;
  });
  
  return initPromise;
}

// Global error handler for the app
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message, stack: err.stack });
});

export default async function (req: Request, res: Response) {
  try {
    await initialize();
  } catch (err) {
    return res.status(500).json({
      error: "Initialization error",
      message: err.message,
      stack: err.stack
    });
  }

  if (initError) {
    return res.status(500).json({
      error: "Initialization error",
      message: initError.message,
      stack: initError.stack
    });
  }

  return app(req, res);
}


