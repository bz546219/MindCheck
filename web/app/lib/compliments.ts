// Handles random compliments after a check-in.

import { prisma } from "./prisma";

// Backup compliments used when the database has no compliments yet.
const FALLBACK = [
  "Showing up today, even just to check in, counts for something.",
  "One honest check-in is a small act of self-care. Nice work.",
  "Taking a moment to check in with yourself is a good step.",
  "You made time to check in today. That's worth recognizing.",
  "Small steps still count. Keep going.",
];

// Choose a random compliment.
export async function randomCompliment() {
  // Find out how many compliments are stored in the database.
  const count = await prisma.compliment.count();

  // If there aren't any yet, use one of our backup compliments.
  if (count === 0) {
    return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  }

  // Choose a random position in the database.
  const skip = Math.floor(Math.random() * count);

  // Get the compliment at that position.
  const [compliment] = await prisma.compliment.findMany({
    skip,
    take: 1,
  });

  // Return the compliment's text.
  return compliment.text;
}