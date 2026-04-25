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
let initError: any = null;

try {
  // Synchronous run, errors will be caught if it strictly throws
  registerRoutes(httpServer, app).catch((err) => {
    console.error("Failed to register routes async:", err);
    initError = err;
  });
} catch (err) {
  console.error("Failed to register routes sync:", err);
  initError = err;
}

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message, stack: err.stack });
});

export default function (req: Request, res: Response) {
  if (initError) {
    return res.status(500).json({
      error: "Initialization error",
      message: initError.message,
      stack: initError.stack
    });
  }
  return app(req, res);
}


