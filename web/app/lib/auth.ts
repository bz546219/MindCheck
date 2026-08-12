// Creates and checks login sessions for users.

import { SignJWT, jwtVerify } from "jose";

// Secret key used to protect our sessions.
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

// Creates a session token for a user.
export async function createSessionToken(userId: string) {
  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

// Checks whether a session token is valid.
export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.userId as string;
  } catch {
    return null;
  }
}