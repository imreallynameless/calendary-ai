import { promises as fs } from "fs";
import { dirname, resolve } from "path";

const TOKEN_DIR = process.env.TOKEN_STORAGE_PATH ?? "./data/tokens";

type StoredToken = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number | undefined;
};

export async function writeToken(userId: string, token: StoredToken) {
  const tokenPath = resolve(TOKEN_DIR, `${userId}.json`);
  await fs.mkdir(dirname(tokenPath), { recursive: true });
  await fs.writeFile(tokenPath, JSON.stringify(token), { encoding: "utf-8" });
}

export async function readToken(userId: string) {
  const tokenPath = resolve(TOKEN_DIR, `${userId}.json`);
  try {
    const content = await fs.readFile(tokenPath, { encoding: "utf-8" });
    return JSON.parse(content) as StoredToken;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function deleteToken(userId: string) {
  const tokenPath = resolve(TOKEN_DIR, `${userId}.json`);
  try {
    await fs.unlink(tokenPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }
}

