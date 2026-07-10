import { getSessionUser } from "../../../src/lib/auth/session";

export default function handler(req, res) {
  res.status(200).json({ user: getSessionUser(req) });
}
