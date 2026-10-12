import { configPayload } from "./_lib/handlers.js";

export default function handler(_req, res) {
  res.status(200).json(configPayload());
}
