// Creates a new anonymous user and gives them a session.

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createSessionToken } from "../../../lib/auth";

// Runs when someone chooses "Continue anonymously".
export async function POST() {
  // Create a new anonymous user in the database.
  const user = await prisma.user.create({
    data: {
      isAnonymous: true,
    },
  });

  // Create a session for that user.
  const token = await createSessionToken(user.id);

  // Send the user's ID back to the app.
  const res = NextResponse.json({
    userId: user.id,
  });

  // Save the session in the browser.
  res.cookies.set("session", token, {
    httpOnly: true,
    path: "/",
  });

  return res;
}