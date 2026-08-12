// Handles saving a user's check-in.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { verifySessionToken } from "../../lib/auth";

export async function POST(req: NextRequest) {
  // Get the user's session from their browser cookie.
  const token = req.cookies.get("session")?.value;

  // Check that the session is valid.
  const userId = token ? await verifySessionToken(token) : null;

  // Stop if the user isn't logged in.
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Get the check-in information from the request.
  const { moodScore, note, latitude, longitude } = await req.json();

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

  // Send the saved check-in back to the app.
  return NextResponse.json({ checkIn });
}

// Handles getting a user's previous check-ins.
export async function GET(req: NextRequest) {
  // Get the user's session from their browser cookie.
  const token = req.cookies.get("session")?.value;

  // Check that the session is valid.
  const userId = token ? await verifySessionToken(token) : null;

  // Stop if the user isn't logged in.
  if (!userId) {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }

  // Get this user's check-ins from the database.
  const checkIns = await prisma.checkIn.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      moodScore: true,
      note: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ checkIns });
}