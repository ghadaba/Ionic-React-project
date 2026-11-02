import { Preferences } from "@capacitor/preferences";
import type { Movie } from "./catalog";
import type { MatchProfile } from "./matching";
import { loadProfilePhoto, removeProfilePhoto, saveProfilePhoto } from "./localPhotos";

const DATABASE_KEY = "cinematch:database:v1";
const MOVIES_KEY = "cinematch:movies:v1";
const SESSION_KEY = "cinematch:session:v1";
const MAX_DATABASE_BYTES = 1_000_000;

export type Profile = MatchProfile & {
  email: string;
  createdAt: number;
  isAdmin: boolean;
};

export type LocalAccount = {
  profile: Profile;
  passwordSalt: string;
  passwordHash: string;
};

export async function loadAccounts(): Promise<LocalAccount[]> {
  const { value } = await Preferences.get({ key: DATABASE_KEY });
  if (!value) return [];

  const parsed: unknown = JSON.parse(value);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("accounts" in parsed) ||
    !Array.isArray(parsed.accounts)
  ) {
    throw new Error("Les données locales du compte sont illisibles.");
  }
  const accounts = parsed.accounts.map((account) => {
    if (
      typeof account !== "object" ||
      account === null ||
      !("profile" in account) ||
      typeof account.profile !== "object" ||
      account.profile === null
    ) {
      throw new Error("Un compte local est illisible.");
    }
    return {
      ...account,
      profile: {
        ...account.profile,
        isAdmin: "isAdmin" in account.profile && account.profile.isAdmin === true,
      },
    } as LocalAccount;
  });
  const hadEmbeddedPhotos = accounts.some((account) => Boolean(account.profile.photoURL));
  const restoredAccounts = await Promise.all(accounts.map(async (account) => {
    if (account.profile.photoURL) await saveProfilePhoto(account.profile.uid, account.profile.photoURL);
    const photoURL = await loadProfilePhoto(account.profile.uid);
    return { ...account, profile: { ...account.profile, photoURL: photoURL ?? "" } };
  }));
  if (hadEmbeddedPhotos) await saveAccounts(restoredAccounts);
  return restoredAccounts;
}

export async function saveAccounts(accounts: LocalAccount[]): Promise<void> {
  const storedAccounts = await Promise.all(accounts.map(async (account) => {
    if (account.profile.photoURL) {
      await saveProfilePhoto(account.profile.uid, account.profile.photoURL);
    } else {
      await removeProfilePhoto(account.profile.uid);
    }
    return {
      ...account,
      profile: { ...account.profile, photoURL: "" },
    };
  }));
  const value = JSON.stringify({ accounts: storedAccounts });
  if (new Blob([value]).size > MAX_DATABASE_BYTES) {
    throw new Error("Les données des comptes locaux dépassent la limite de stockage.");
  }
  await Preferences.set({ key: DATABASE_KEY, value });
}

export async function loadMovies(): Promise<Movie[]> {
  const { value } = await Preferences.get({ key: MOVIES_KEY });
  if (!value) return [];

  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error("Le catalogue local est illisible.");
  }
  return parsed as Movie[];
}

export async function saveMovies(movies: Movie[]): Promise<void> {
  await Preferences.set({ key: MOVIES_KEY, value: JSON.stringify(movies) });
}

export async function loadSessionUid(): Promise<string | null> {
  const { value } = await Preferences.get({ key: SESSION_KEY });
  return value;
}

export async function saveSessionUid(uid: string): Promise<void> {
  await Preferences.set({ key: SESSION_KEY, value: uid });
}

export async function clearSession(): Promise<void> {
  await Preferences.remove({ key: SESSION_KEY });
}

export async function createPasswordHash(password: string): Promise<{
  salt: string;
  hash: string;
}> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = toHex(saltBytes);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return { salt, hash: toHex(new Uint8Array(derivedBits)) };
}

export async function verifyPassword(
  password: string,
  salt: string,
  expectedHash: string,
): Promise<boolean> {
  const saltBytes = fromHex(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 120_000, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(new Uint8Array(derivedBits)) === expectedHash;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string): Uint8Array {
  if (!/^(?:[0-9a-f]{2})+$/i.test(value)) {
    throw new Error("Les données locales du mot de passe sont illisibles.");
  }
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16));
}
