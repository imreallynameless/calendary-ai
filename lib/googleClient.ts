import { readFile } from "fs/promises";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { readToken, writeToken } from "@/lib/tokenStore";

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const credentialsCache: Partial<OAuthConfig> = {};

async function loadOAuthConfig(): Promise<OAuthConfig> {
  if (credentialsCache.clientId && credentialsCache.clientSecret && credentialsCache.redirectUri) {
    return credentialsCache as OAuthConfig;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    const fileContent = await readFile("config/google-client-secret.json", "utf-8");
    const parsed = JSON.parse(fileContent);
    const webConfig = parsed.web ?? parsed.installed;
    if (!webConfig) {
      throw new Error("Invalid Google OAuth secret file: missing web configuration");
    }
    credentialsCache.clientId = webConfig.client_id;
    credentialsCache.clientSecret = webConfig.client_secret;
    credentialsCache.redirectUri = webConfig.redirect_uris?.[0];
  } else {
    credentialsCache.clientId = clientId;
    credentialsCache.clientSecret = clientSecret;
    credentialsCache.redirectUri = redirectUri;
  }

  if (!credentialsCache.clientId || !credentialsCache.clientSecret || !credentialsCache.redirectUri) {
    throw new Error("Missing Google OAuth configuration");
  }

  return credentialsCache as OAuthConfig;
}

export async function getOAuthClient(userId?: string) {
  const config = await loadOAuthConfig();
  const client = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri);

  if (!userId) {
    return client;
  }

  const token = await readToken(userId);
  if (token) {
    client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiryDate,
    });
  }

  client.on("tokens", async (tokens) => {
    if (!userId) {
      return;
    }

    if (tokens.refresh_token || tokens.access_token) {
      await writeToken(userId, {
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? token?.refreshToken ?? "",
        expiryDate: tokens.expiry_date,
      });
    }
  });

  return client;
}

export async function getCalendarClient(userId: string) {
  const auth = await getOAuthClient(userId);
  return google.calendar({ version: "v3", auth });
}

export async function getOAuthConsentUrl(scopes: string[], state: string) {
  const client = await getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state,
  });
}

export async function exchangeCodeForTokens(code: string, userId: string) {
  const client = await getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token && !tokens.access_token) {
    throw new Error("OAuth exchange did not return tokens");
  }

  await writeToken(userId, {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? "",
    expiryDate: tokens.expiry_date,
  });
}

