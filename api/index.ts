// Vercel Serverless Function entry point
// This file exposes the Express app as a serverless function handler.
// Vercel will route all /api/* requests here.

import { app } from "../server/index";

export default app;
