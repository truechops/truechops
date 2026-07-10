import {
  clearOAuthCookies,
  createSessionCookie,
  getBaseUrl,
  getGoogleOAuthConfig,
  getOAuthCookies,
  sanitizeReturnTo,
  upsertGoogleUser,
} from "../../../../src/lib/auth/session";

async function exchangeCodeForTokens(code, redirectUri) {
  const { clientId, clientSecret } = getGoogleOAuthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed.");
  }

  return response.json();
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Google profile lookup failed.");
  }

  const profile = await response.json();

  if (!profile.sub || !profile.email) {
    throw new Error("Google did not return the required profile fields.");
  }

  if (profile.email_verified !== true && profile.email_verified !== "true") {
    throw new Error("Google account email is not verified.");
  }

  return profile;
}

function redirectToLoginError(res, message) {
  const query = new URLSearchParams({ authError: message });
  res.setHeader("Set-Cookie", clearOAuthCookies());
  res.redirect(`/login?${query.toString()}`);
}

function firstQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const code = firstQueryValue(req.query.code);
  const error = firstQueryValue(req.query.error);
  const state = firstQueryValue(req.query.state);
  const oauthCookies = getOAuthCookies(req);

  if (error) {
    redirectToLoginError(res, "Google login was cancelled.");
    return;
  }

  if (!code || state !== oauthCookies.state) {
    redirectToLoginError(res, "Google login session expired. Please try again.");
    return;
  }

  try {
    const redirectUri = `${getBaseUrl(req)}/api/auth/google/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    if (!tokens.access_token) {
      throw new Error("Google did not return an access token.");
    }

    const profile = await fetchGoogleProfile(tokens.access_token);
    const user = await upsertGoogleUser(profile);
    const returnTo = sanitizeReturnTo(oauthCookies.returnTo);

    res.setHeader("Set-Cookie", [createSessionCookie(user), ...clearOAuthCookies()]);
    res.redirect(returnTo);
  } catch (callbackError) {
    redirectToLoginError(res, callbackError.message || "Google login failed.");
  }
}
