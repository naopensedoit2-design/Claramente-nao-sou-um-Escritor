import type { Request, Response } from "express";

export default function (req: Request, res: Response) {
  res.status(200).json({ ok: true, message: "PONG" });
}
