import { clearSessionCookie } from "../../../src/lib/auth/session";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(200).json({ user: null });
}
