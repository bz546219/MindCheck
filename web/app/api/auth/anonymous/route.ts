import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createSessionToken } from "../../../lib/auth";

export async function POST() {
  try {
    // Create an anonymous user.
    const user = await prisma.user.create({
      data: {
        isAnonymous: true,
      },
    });

    // Create a 30-day session token.
    const token = await createSessionToken(user.id);

    // Return the token in JSON so the mobile app can store it.
    const response = NextResponse.json({
      userId: user.id,
      token,
    });

    // Also keep the cookie for the web app.
    response.cookies.set("session", token, {
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });

    return response;
  } catch (error) {
    console.error(
      "Failed to create anonymous session:",
      error
    );

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