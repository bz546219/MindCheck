// Connects our app to the PostgreSQL database.

import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This file's whole job is to open one connection to your database and
// hand it out to the rest of the app. Instead of every file figuring
// out how to talk to PostgreSQL directly, they just do:
//
//   import { prisma } from "./lib/prisma";
//   prisma.checkIn.findMany(...)
//
// "Prisma" is a tool that lets us work with the database using normal
// JavaScript/TypeScript function calls (like .create(), .findMany())
// instead of writing raw SQL queries by hand.
// -----------------------------------------------------------------------

// ---- THE ADAPTER: HOW WE ACTUALLY REACH THE DATABASE ----
// PrismaPg is the specific "translator" that knows how to speak to a
// PostgreSQL database over the network.
//
// connectionString tells it WHERE the database lives and how to log in
// — things like the host, port, database name, username, and password,
// all bundled into one string. That value lives in your environment
// variables (DATABASE_URL), not typed directly in this file, so the
// real credentials never get committed to your code.
//
// The "!" after process.env.DATABASE_URL is a TypeScript-only symbol
// meaning "trust me, this will definitely be set — don't warn me that
// it might be undefined." (If it's NOT actually set, the app will
// crash with an error when it tries to connect, which is a good signal
// to go check your environment variables.)
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

// ---- CREATE THE ACTUAL DATABASE CONNECTION ----
// PrismaClient is the main object used everywhere else in the app to
// read and write data (e.g. prisma.checkIn.create(...),
// prisma.checkIn.findMany(...)). We hand it the adapter above so it
// knows to use PostgreSQL.
//
// We create this ONE time here and export it, rather than creating a
// new one in every file. Database connections are relatively expensive
// to set up, so sharing a single instance across the whole app is much
// more efficient than opening a fresh one every time something needs
// the database.
export const prisma = new PrismaClient({
  adapter,
});