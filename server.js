// Local server: serves the static site and the same /api routes Vercel runs.
import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { compare, configPayload, speech } from "./api/_lib/handlers.js";

const PORT = Number(process.env.PORT) || 3000;
const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/api/config", (_req, res) => res.json(configPayload()));
app.post("/api/compare", async (req, res) => {
  const { status, body } = await compare(req.body);
  res.status(status).json(body);
});

app.post("/api/speak", async (req, res) => {
  const { status, body, contentType } = await speech(req.body);
  if (contentType) return res.status(status).type(contentType).send(body);
  res.status(status).json(body);
});

const root = fileURLToPath(new URL(".", import.meta.url));
app.use(express.static(root, { dotfiles: "ignore", index: "index.html" }));

app.listen(PORT, () => {
  const mode = process.env.MOCK === "1" ? " (MOCK mode)" : "";
  console.log(`Compare page: http://localhost:${PORT}/${mode}`);
});
