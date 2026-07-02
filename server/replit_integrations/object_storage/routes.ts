import type { Express, RequestHandler } from "express";
import express from "express";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { assets } from "../../../shared/schema";
import { eq } from "drizzle-orm";

export function registerObjectStorageRoutes(app: Express, isAuthenticated: RequestHandler): void {
  /**
   * Request a URL for file upload.
   * On Vercel, we return a local API URL that will handle the binary upload.
   * Requires an authenticated admin session — this issues a writable URL.
   */
  app.post("/api/uploads/request-url", isAuthenticated, async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Missing required field: name" });
      }

      const objectId = randomUUID();
      // On Vercel, we point the upload URL to our own binary handler
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const uploadURL = `${protocol}://${host}/api/uploads/binary/${objectId}?contentType=${encodeURIComponent(contentType || 'application/octet-stream')}`;
      const objectPath = `/objects/${objectId}`;

      res.json({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error("Error generating upload URL:", error);
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  });

  /**
   * Handle the binary upload and save to Database.
   * CRITICAL FIX: Do NOT use multer here — Uppy sends raw binary data, not multipart form.
   * This endpoint handles raw PUT body directly.
   * 
   * NOTE: isAuthenticated is removed here because Uppy's AwsS3 plugin does not send 
   * session cookies by default on PUT requests. The objectId (UUIDv4) acts as a secure token.
   */
  app.put("/api/uploads/binary/:id", express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
      const { id } = req.params;
      const contentType = req.query.contentType as string || "application/octet-stream";
      
      const buffer = req.body instanceof Buffer ? req.body : Buffer.alloc(0);

      if (buffer.length === 0) {
        return res.status(400).json({ error: "No file data received" });
      }

      console.log(`[Upload] Saving file ${id}, size: ${buffer.length} bytes, type: ${contentType}`);

      const base64Content = buffer.toString("base64");

      await db.insert(assets).values({
        id,
        contentType,
        content: base64Content,
      });

      console.log(`[Upload] File saved successfully: ${id}`);
      res.json({ success: true, objectPath: `/objects/${id}` });
    } catch (error) {
      console.error("Error saving binary upload:", error);
      res.status(500).json({ error: "Failed to save upload" });
    }
  });

  /**
   * Serve uploaded objects from the Database.
   */
  app.get("/objects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [asset] = await db.select().from(assets).where(eq(assets.id, id));

      if (!asset) {
        return res.status(404).json({ error: "Object not found" });
      }

      const buffer = Buffer.from(asset.content, "base64");
      
      res.set({
        "Content-Type": asset.contentType,
        "Content-Length": buffer.length,
        "Cache-Control": "public, max-age=31536000",
      });

      res.send(buffer);
    } catch (error) {
      console.error("Error serving object:", error);
      res.status(500).json({ error: "Failed to serve object" });
    }
  });
}
