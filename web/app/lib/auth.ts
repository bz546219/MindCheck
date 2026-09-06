// Creates and checks login sessions for users.

import { SignJWT, jwtVerify } from "jose";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This file is the "ID card office" for the app. It doesn't handle
// logging in directly — instead it does two related jobs:
//   1. createSessionToken: once we know who a user is, stamp out a
//      digital "ID card" (called a token) proving it.
//   2. verifySessionToken: given one of those ID cards, check that it's
//      real (not forged) and hasn't expired, and read whose it is.
// Other files (like the check-ins API) call verifySessionToken to
// answer "who is making this request?"
// -----------------------------------------------------------------------

// ---- THE SECRET KEY ----
// Every token we create is "signed" with this secret key, kind of like
// a stamp of authenticity. Anyone who has this secret could forge a
// valid-looking ID card, so it must never be shared publicly or
// committed to a public repo.
//
// process.env.JWT_SECRET reads the real secret from your environment
// variables (set on your server / hosting provider). The
// "dev-secret-change-me" after the "||" is only a fallback used when
// that environment variable isn't set — handy for testing on your own
// computer, but it means: make sure JWT_SECRET is actually set in
// production, or anyone could forge login sessions.
const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me"
);

// ---- CREATE A SESSION TOKEN (the "ID card") ----
// Call this after a user has proven who they are (e.g. after they sign
// in). It packages up their userId into a signed token that can later
// be handed back to prove "this is definitely user X."
export async function createSessionToken(userId: string) {
  return await new SignJWT({ userId }) // the actual data being stored: { userId: "..." }
    .setProtectedHeader({ alg: "HS256" }) // which signing method to use (a standard, secure one)
    .setExpirationTime("30d") // this ID card automatically stops working after 30 days
    .sign(secret); // stamp/sign it with our secret key so it can't be faked
}

// ---- CHECK IF A SESSION TOKEN IS VALID ----
// Call this whenever a request comes in with a token (from a cookie or
// a mobile app's Bearer header) and you need to know: is this real, and
// who does it belong to?
export async function verifySessionToken(token: string) {
  try {
    // jwtVerify checks the token's signature against our secret key.
    // If someone tampered with it, used a fake one, or it expired,
    // this line throws an error and we jump to "catch" below.
    const { payload } = await jwtVerify(token, secret);

    // If we get here, the token is genuine. "payload" is the data we
    // originally stored in it (the { userId } object), so we pull the
    // userId back out and return it.
    return payload.userId as string;
  } catch {
    // Invalid, tampered-with, or expired token — treat it as "not
    // logged in" rather than crashing anything.
    return null;
  }
}