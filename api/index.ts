// Vercel Serverless Function — Express handler
// Self-contained setup that does NOT depend on server/index.ts
// to avoid async race conditions at cold start.

import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";

const app = express();

// Body parsing middleware
app.use(
  express.json({
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: false }));

// Request logger
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on("finish", () => {
    if (req.path.startsWith("/api") || req.path.startsWith("/objects")) {
      console.log(`${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`);
    }
  });
  next();
});

// Register all routes synchronously (seedDatabase is now fire-and-forget)
const httpServer = createServer(app);
registerRoutes(httpServer, app).catch((err) => {
  console.error("Failed to register routes:", err);
});

// Global error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
});

export default app;
