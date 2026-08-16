import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { verifySessionToken } from "../../lib/auth";
import { maybeSendAlert } from "../../lib/alerts";
import { randomCompliment } from "../../lib/compliments";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This is a "backend" file — it runs on the server, not in the user's
// browser. The frontend page (page.tsx) calls fetch("/api/checkins") and
// this file is what answers that call. It has two parts:
//   - POST = "someone is SUBMITTING a new check-in, save it"
//   - GET  = "someone wants to SEE their past check-ins, send the list"
// (POST and GET are just the two most common types of web requests:
// POST = create/send data, GET = read/fetch data.)
// -----------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ---- FIGURE OUT WHO IS MAKING THIS REQUEST ----
    // This app can be used from a web browser OR the mobile app, and
    // each one proves "who the user is" a different way:
    //   - Web browsers automatically send a "session" cookie
    //   - The mobile app instead sends a special "Bearer" token in the
    //     request headers (cookies don't work well on mobile)
    // So we check for both and use whichever one is present.

    const cookieToken = req.cookies.get("session")?.value;

    const authHeader = req.headers.get("authorization");

    // If there's an "authorization" header and it starts with "Bearer ",
    // pull out just the token part (everything after "Bearer ").
    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    // Prefer the cookie (web) if we have one; otherwise fall back to the
    // mobile app's Bearer token.
    const token = cookieToken || bearerToken;

    // Turn that raw token into an actual user ID, if it's valid.
    // (verifySessionToken checks that the token is real and not expired.)
    const userId = token ? await verifySessionToken(token) : null;

    // If we couldn't identify a valid, logged-in user, reject the
    // request. Status 401 is the standard web code for "not logged in."
    if (!userId) {
      return NextResponse.json(
        {
          error: "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    // ---- READ THE CHECK-IN DATA THE FRONTEND SENT ----
    // req.json() reads the body of the request (the data the frontend
    // packed into the fetch() call) and turns it into a normal object.
    const { moodScore, note, latitude, longitude } = await req.json();

    // ---- SAVE THE CHECK-IN TO THE DATABASE ----
    // prisma.checkIn.create(...) writes a new row into the "CheckIn"
    // table in the database, permanently storing this check-in.
    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        moodScore,
        note,
        latitude,
        longitude,
      },
    });

    // ---- CHECK IF A TRUSTED CONTACT SHOULD BE ALERTED ----
    // For example, if the mood score is very low, this might text or
    // email someone the user has designated as a trusted contact.
    // That logic lives in lib/alerts.ts — this file just calls it.
    const alertResult = await maybeSendAlert(checkIn);

    // ---- PICK AN ENCOURAGING MESSAGE ----
    // Grabs a random supportive message to show the user after they
    // check in (the "A little encouragement" box on the frontend).
    const compliment = await randomCompliment();

    // ---- SEND EVERYTHING BACK TO THE FRONTEND ----
    // This is the data the fetch() call in page.tsx receives back and
    // uses to update the screen (show the compliment, refresh the list, etc).
    return NextResponse.json({
      checkIn,
      alertSent: alertResult.sent,
      compliment,
    });
  } catch (error) {
    // If ANYTHING above throws an error (bad data, database problem,
    // etc.), we land here instead of crashing the server. We log the
    // real error for ourselves, but only send the user a generic,
    // safe error message.
    console.error("Failed to create check-in:", error);

    return NextResponse.json(
      {
        error: "Failed to create check-in",
      },
      {
        status: 500, // 500 = "something went wrong on the server"
      }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // ---- SAME AUTHENTICATION CHECK AS ABOVE ----
    // (See the detailed comments in the POST function above — this does
    // the exact same "figure out who's asking" logic.)

    const cookieToken = req.cookies.get("session")?.value;

    const authHeader = req.headers.get("authorization");

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const token = cookieToken || bearerToken;

    const userId = token ? await verifySessionToken(token) : null;

    // If we don't know who's asking, don't hand back anyone's data.
    if (!userId) {
      return NextResponse.json(
        {
          error: "Not authenticated",
        },
        {
          status: 401,
        }
      );
    }

    // ---- FETCH THIS USER'S CHECK-INS FROM THE DATABASE ----
    // findMany = "give me a list of matching rows."
    // where: { userId } = "only rows that belong to this exact user"
    //   (this is important — it makes sure one user can never see
    //   another user's check-ins).
    // orderBy: createdAt "desc" = newest check-ins first.
    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Send the list back to the frontend, which uses it to draw the
    // mood chart, summary stats, and recent check-ins list.
    return NextResponse.json({
      checkIns,
    });
  } catch (error) {
    console.error("Failed to load check-ins:", error);

    return NextResponse.json(
      {
        error: "Failed to load check-ins",
      },
      {
        status: 500,
      }
    );
  }
}