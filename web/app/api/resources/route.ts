// Handles support-resource requests for MindCheck.

import { NextRequest, NextResponse } from "next/server";

// Official, location-independent support resources.
// We are using curated resources instead of an external paid
// maps/search service.
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

// GET /api/resources
// GET /api/resources?lat=...&lng=...
export async function GET(req: NextRequest) {
  // Read the location from the URL if it was provided.
  const { searchParams } = new URL(req.url);

  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  // If the user did not share a location,
  // return the general resources.
  if (!lat || !lng) {
    return NextResponse.json({
      resources: SUPPORT_RESOURCES,
      nearby: [],
    });
  }

  // Convert the coordinates into numbers.
  const latitude = Number(lat);
  const longitude = Number(lng);

  // Make sure the coordinates are valid.
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      {
        error: "Invalid location.",
      },
      {
        status: 400,
      }
    );
  }

  // We are not using a paid maps service.
  // The location is accepted so we can add verified local
  // resources later without changing the API structure.
  return NextResponse.json({
    resources: SUPPORT_RESOURCES,
    nearby: [],
    location: {
      latitude,
      longitude,
    },
  });
}