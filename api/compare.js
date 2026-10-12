import { compare } from "./_lib/handlers.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Use POST" });
  }
  const { status, body } = await compare(req.body, req.headers["x-compare-passcode"]);
  res.status(status).json(body);
}
