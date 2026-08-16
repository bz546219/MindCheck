// Handles support-resource requests for MindCheck.

import { NextRequest, NextResponse } from "next/server";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This is the backend route behind "/api/resources" — the endpoint the
// frontend calls (loadResources in page.tsx) after the user shares
// their location, to get a list of support resources to display.
// -----------------------------------------------------------------------

// ---- THE LIST OF SUPPORT RESOURCES ----
// This is a fixed, hand-picked (not location-specific) list of
// legitimate national support resources, stored directly in the code.
// The comment above it explains WHY: rather than paying for a
// maps/search API to find resources "near" someone, this app currently
// just shows the same trustworthy, general resources to everyone.
const SUPPORT_RESOURCES = [
  {
    name: "988 Suicide & Crisis Lifeline",
    type: "Crisis support",
    phone: "988",
    description:
      "Call or text 988 for free, confidential crisis support in the United States and its territories.",
    url: "https://988lifeline.org/get-help/",
  },
  {
    name: "SAMHSA National Helpline",
    type: "Mental health and treatment support",
    phone: "1-800-662-4357",
    description:
      "Free, confidential information and treatment referrals for mental health and substance use concerns.",
    url: "https://www.samhsa.gov/find-help/helplines",
  },
  {
    name: "FindTreatment.gov",
    type: "Treatment locator",
    description:
      "Search for mental health and substance use treatment services by location and other criteria.",
    url: "https://findtreatment.gov/",
  },
  {
    name: "FindSupport.gov",
    type: "Behavioral health support",
    description:
      "An online guide for finding information and support for behavioral health needs.",
    url: "https://www.samhsa.gov/find-support",
  },
];

// ---- THE ACTUAL ENDPOINT ----
// This one function handles two slightly different situations, both
// using the same URL:
//   GET /api/resources               (no location given)
//   GET /api/resources?lat=...&lng=... (location given)
// "GET" means this endpoint is only for reading/fetching data, not
// creating or changing anything.
export async function GET(req: NextRequest) {
  // req.url is the full URL that was requested, including anything
  // after the "?" (called "query parameters" or "search params"). The
  // built-in URL class parses that out for us so we can read individual
  // pieces, like "lat" and "lng", by name.
  const { searchParams } = new URL(req.url);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  // ---- CASE 1: NO LOCATION WAS PROVIDED ----
  // If the user hasn't shared their location (lat/lng are missing),
  // just send back the general resource list, with an empty "nearby"
  // list (since we have no location to base "nearby" on).
  if (!lat || !lng) {
    return NextResponse.json({
      resources: SUPPORT_RESOURCES,
      nearby: [],
    });
  }

  // ---- CASE 2: A LOCATION WAS PROVIDED ----
  // URL parameters always arrive as text (strings), even though lat/lng
  // are really numbers, so we convert them here.
  const latitude = Number(lat);
  const longitude = Number(lng);

  // Make sure the conversion actually produced real, usable numbers
  // (e.g. someone could pass ?lat=banana by mistake or on purpose —
  // Number("banana") would be NaN, which Number.isFinite correctly
  // flags as invalid).
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      {
        error: "Invalid location.",
      },
      {
        status: 400, // 400 = "the request itself was malformed"
      }
    );
  }

  // Even though we now have a valid location, we still return the same
  // general resource list (again, because we're not using a paid
  // location-lookup service yet). The comment explains this is
  // intentional: by still accepting and returning the location here,
  // the API's "shape" is already set up to support truly location-based
  // results later — you'd just fill in the "nearby" array with real
  // data without needing to change how the frontend calls this endpoint.
  return NextResponse.json({
    resources: SUPPORT_RESOURCES,
    nearby: [],
    location: {
      latitude,
      longitude,
    },
  });
}