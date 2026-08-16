// Handles random compliments after a check-in.

import { prisma } from "./prisma";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This file's one job is: pick a random encouraging message to show the
// user after they check in. It first tries to pull one from the
// database (so you/admins can add and manage compliments over time).
// If the database doesn't have any compliments stored yet, it falls
// back to a small built-in list so the feature still works.
// -----------------------------------------------------------------------

// ---- BACKUP COMPLIMENTS ----
// This is a plain list of messages kept directly in the code (not the
// database). It's a safety net — used only if the "Compliment" table in
// the database is empty, so users still see something encouraging
// instead of an error or blank message.
const FALLBACK = [
  "Showing up today, even just to check in, counts for something.",
  "One honest check-in is a small act of self-care. Nice work.",
  "Taking a moment to check in with yourself is a good step.",
  "You made time to check in today. That's worth recognizing.",
  "Small steps still count. Keep going.",
];

// ---- PICK ONE RANDOM COMPLIMENT ----
export async function randomCompliment() {
  // First, ask the database: "how many compliments do you have stored?"
  // count() just returns a number, not the actual compliments.
  const count = await prisma.compliment.count();

  // If there are zero compliments in the database, skip the database
  // entirely and grab a random one from our backup list instead.
  //   Math.random() gives a random decimal between 0 and 1 (e.g. 0.42)
  //   Multiplying by FALLBACK.length scales it to the list's size
  //   Math.floor() rounds down to a whole number we can use as an index
  if (count === 0) {
    return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  }

  // Otherwise, there ARE compliments in the database — pick a random
  // one. Databases don't have a built-in "give me one random row"
  // button, so the common trick is:
  //   1. Know how many rows exist (we already do: "count")
  //   2. Pick a random position/index between 0 and count-1
  //   3. Ask the database to "skip" that many rows and take just 1
  // That effectively lands us on a random row.
  const skip = Math.floor(Math.random() * count);

  // findMany with { skip, take: 1 } returns a list containing just one
  // compliment (the one at that random position). We immediately pull
  // it out of the list using array destructuring: "[compliment] ="
  // means "take the first item in this list and call it 'compliment'."
  const [compliment] = await prisma.compliment.findMany({
    skip,
    take: 1,
  });

  // The database row has other fields too (like an id), but we only
  // need the actual message text to show the user.
  return compliment.text;
}