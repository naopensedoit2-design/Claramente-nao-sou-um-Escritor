// Vercel Serverless Function — Express handler
// Lazy-loads the app to catch top-level module errors.

import type { Request, Response, NextFunction } from "express";

let appPromise: Promise<any> | null = null;
let initError: any = null;

async function bootstrap() {
  try {
    const express = (await import("express")).default;
    const { createServer } = await import("http");
    const { registerRoutes } = await import("../server/routes");

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
    await registerRoutes(httpServer, app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      res.status(status).json({ message, stack: err.stack });
    });

    return app;
  } catch (err: any) {
    console.error("Failed to bootstrap app:", err);
    initError = err;
    throw err;
  }
}

export default async function (req: Request, res: Response, next: NextFunction) {
  if (initError) {
    return res.status(500).json({
      error: "Initialization error",
      message: initError.message,
      stack: initError.stack
    });
  }

  if (!appPromise) {
    appPromise = bootstrap();
  }

  try {
    const app = await appPromise;
    return app(req, res, next);
  } catch (err: any) {
    return res.status(500).json({
      error: "Bootstrap error",
      message: err.message,
      stack: err.stack
    });
  }
}

