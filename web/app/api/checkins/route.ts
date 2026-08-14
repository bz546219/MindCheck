import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { verifySessionToken } from "../../lib/auth";
import { maybeSendAlert } from "../../lib/alerts";
import { randomCompliment } from "../../lib/compliments";

export async function POST(req: NextRequest) {
  try {
    // Support both:
    // 1. Web browser session cookies
    // 2. Mobile app Bearer tokens

    const cookieToken = req.cookies.get("session")?.value;

    const authHeader = req.headers.get("authorization");

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    // Use the cookie if it exists.
    // Otherwise use the mobile Bearer token.
    const token = cookieToken || bearerToken;

    const userId = token
      ? await verifySessionToken(token)
      : null;

    // Make sure the user is authenticated.
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

    // Get the check-in information from the request.
    const {
      moodScore,
      note,
      latitude,
      longitude,
    } = await req.json();

    // Save the check-in to the database.
    const checkIn = await prisma.checkIn.create({
      data: {
        userId,
        moodScore,
        note,
        latitude,
        longitude,
      },
    });

    // Check whether this check-in should trigger
    // a trusted-contact alert.
    const alertResult = await maybeSendAlert(checkIn);

    // Choose an encouragement message.
    const compliment = await randomCompliment();

    // Send the result back to the frontend.
    return NextResponse.json({
      checkIn,
      alertSent: alertResult.sent,
      compliment,
    });
  } catch (error) {
    console.error(
      "Failed to create check-in:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to create check-in",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Support both:
    // 1. Web browser session cookies
    // 2. Mobile app Bearer tokens

    const cookieToken = req.cookies.get("session")?.value;

    const authHeader = req.headers.get("authorization");

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.substring(7)
      : null;

    const token = cookieToken || bearerToken;

    const userId = token
      ? await verifySessionToken(token)
      : null;

    // Make sure the user is authenticated.
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

    // Get this user's previous check-ins.
    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      checkIns,
    });
  } catch (error) {
    console.error(
      "Failed to load check-ins:",
      error
    );

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