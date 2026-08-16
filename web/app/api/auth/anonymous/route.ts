import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createSessionToken } from "../../../lib/auth";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This is the backend route behind the "/api/auth/anonymous" URL.
// Remember from page.tsx: when a user first opens the app and has no
// session yet, the frontend automatically calls this endpoint to set
// one up for them — no sign-up form, no email/password. It just creates
// a brand-new, anonymous account on the spot and hands back proof of it
// (a session token), so the user can start checking in right away.
// -----------------------------------------------------------------------

export async function POST() {
  try {
    // ---- STEP 1: CREATE A NEW ANONYMOUS USER IN THE DATABASE ----
    // This adds a new row to the "User" table with isAnonymous set to
    // true, so it's clear later on that this account was never tied to
    // an email/password — just created automatically for someone who
    // showed up and started using the app.
    const user = await prisma.user.create({
      data: {
        isAnonymous: true,
      },
    });

    // ---- STEP 2: CREATE A SESSION TOKEN FOR THIS NEW USER ----
    // This is the "ID card" from lib/auth.ts — it proves that whoever
    // holds this token is this specific user.id, and it's valid for 30
    // days.
    const token = await createSessionToken(user.id);

    // ---- STEP 3: SEND THE TOKEN BACK TO WHOEVER ASKED ----
    // We include the token directly in the JSON response body. This
    // matters for the MOBILE app specifically — mobile apps don't
    // automatically handle cookies the way web browsers do, so the
    // mobile app needs to receive this token directly and store it
    // itself (then send it back later as a "Bearer" token, like we saw
    // in the check-ins API route).
    const response = NextResponse.json({
      userId: user.id,
      token,
    });

    // ---- STEP 4: ALSO SET A COOKIE, FOR THE WEB APP ----
    // Web browsers, unlike mobile apps, handle cookies automatically —
    // once we set this cookie, the browser will automatically attach it
    // to every future request to our site, without the frontend code
    // needing to manually manage it. So web users get the token via
    // this cookie instead of having to store the JSON response
    // themselves.
    //
        // What each cookie option means:
    //   httpOnly: true   -> JavaScript running in the browser can't read
    //                       this cookie (protects it from certain attacks)
    //   path: "/"        -> send this cookie on requests to any page on the site
    //   maxAge: 30 days  -> (in seconds) how long the cookie lasts before
    //                       the browser deletes it automatically
    //   sameSite: "lax"  -> a safety setting that helps prevent the cookie
    //                       from being sent along with requests from other,
    //                       unrelated websites
    response.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 60 seconds × 60 minutes × 24 hours × 30 days
      sameSite: "lax",
    });

    // Send everything back — the response now carries both the JSON
    // body (for mobile) and the cookie (for web) at the same time.
    return response;
  } catch (error) {
    // If creating the user or token fails for any reason (e.g. the
    // database is unreachable), log the real error for debugging and
    // send back a generic, safe error message instead of crashing.
    console.error("Failed to create anonymous session:", error);

    return NextResponse.json(
      {
        error: "Failed to create anonymous session",
      },
      {
        status: 500,
      }
    );
  }
}