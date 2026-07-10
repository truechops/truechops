import {
  clearOAuthCookies,
  createOAuthCookies,
  getBaseUrl,
  getGoogleOAuthConfig,
  randomToken,
  sanitizeReturnTo,
} from "../../../../src/lib/auth/session";

export default function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { clientId } = getGoogleOAuthConfig();
    const state = randomToken();
    const returnTo = sanitizeReturnTo(req.query.returnTo);
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    authUrl.searchParams.set("access_type", "online");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("include_granted_scopes", "true");
    authUrl.searchParams.set("prompt", "select_account");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", state);

    res.setHeader("Set-Cookie", createOAuthCookies(state, returnTo));
    res.redirect(authUrl.toString());
  } catch (error) {
    const query = new URLSearchParams({
      authError: error.message || "Unable to start Google login",
    });

    res.setHeader("Set-Cookie", clearOAuthCookies());
    res.redirect(`/login?${query.toString()}`);
  }
}
