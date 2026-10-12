import { speech } from "./_lib/handlers.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }
  const { status, body, contentType } = await speech(req.body);
  if (contentType) {
    res.setHeader("Content-Type", contentType);
    return res.status(status).send(body);
  }
  res.status(status).json(body);
}
