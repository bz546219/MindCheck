// Connects our app to the PostgreSQL database.

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

// Creates the database connection.
export const prisma = new PrismaClient({
  adapter,
});