import type { Express } from "express";
import { randomUUID } from "crypto";
import { db } from "../../db";
import { assets } from "../../../shared/schema";
import { eq } from "drizzle-orm";
import multer from "multer";

const upload = multer({ 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit for DB storage
});

export function registerObjectStorageRoutes(app: Express): void {
  /**
   * Request a URL for file upload.
   * On Vercel, we return a local API URL that will handle the binary upload.
   */
  app.post("/api/uploads/request-url", async (req, res) => {
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
   * Uppy uses PUT by default for the presigned URL flow.
   */
  app.put("/api/uploads/binary/:id", upload.single("file"), async (req, res) => {
    try {
      const { id } = req.params;
      const contentType = req.query.contentType as string || "application/octet-stream";
      
      // If multer didn't pick it up as 'file' (standard PUT), we read raw body
      let buffer: Buffer;
      if (req.file) {
        buffer = req.file.buffer;
      } else {
        // Handle raw PUT body
        const chunks: any[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        buffer = Buffer.concat(chunks);
      }

      const base64Content = buffer.toString("base64");

      await db.insert(assets).values({
        id,
        contentType,
        content: base64Content,
      });

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
