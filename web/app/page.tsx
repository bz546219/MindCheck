"use client";

import { useEffect, useState } from "react";

type CheckIn = {
  id: string;
  moodScore: number;
  note: string | null;
  createdAt: string;
};

type Resource = {
  name: string;
  type: string;
  phone?: string;
  description: string;
  url?: string;
};

export default function Home() {
  const [compliment, setCompliment] = useState("");
  const [moodScore, setMoodScore] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [showSafetyMessage, setShowSafetyMessage] = useState(false);

  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  const [resources, setResources] = useState<Resource[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [showCheckIns, setShowCheckIns] = useState(false);

  const averageMood =
    checkIns.length > 0
      ? (
          checkIns.reduce(
            (sum, checkIn) => sum + checkIn.moodScore,
            0
          ) / checkIns.length
        ).toFixed(1)
      : "—";

  const highestMood =
    checkIns.length > 0
      ? Math.max(...checkIns.map((checkIn) => checkIn.moodScore))
      : "—";

  const lowestMood =
    checkIns.length > 0
      ? Math.min(...checkIns.map((checkIn) => checkIn.moodScore))
      : "—";

  let moodTrend = "—";

  if (checkIns.length >= 2) {
    const latestMood = checkIns[0].moodScore;
    const previousMood = checkIns[1].moodScore;

    if (latestMood > previousMood) {
      moodTrend = "↑ Increasing";
    } else if (latestMood < previousMood) {
      moodTrend = "↓ Decreasing";
    } else {
      moodTrend = "→ Stable";
    }
  }

  // Load previous check-ins.
  useEffect(() => {
    async function loadCheckIns() {
      try {
        let response = await fetch("/api/checkins");

if (response.status === 401) {
  const authResponse = await fetch("/api/auth/anonymous", {
    method: "POST",
  });

  if (!authResponse.ok) {
    throw new Error("Failed to create anonymous session");
  }

  response = await fetch("/api/checkins");
}

if (!response.ok) {
  throw new Error("Failed to load check-ins");
}

const data = await response.json();

        setCheckIns(data.checkIns);
      } catch (error) {
        console.error("Failed to load check-ins:", error);
      }
    }

    loadCheckIns();
  }, []);

  // Load support resources.
  async function loadResources(
    currentLatitude: number,
    currentLongitude: number
  ) {
    try {
      const response = await fetch(
        `/api/resources?lat=${currentLatitude}&lng=${currentLongitude}`
      );

      if (!response.ok) {
        throw new Error("Failed to load resources");
      }

      const data = await response.json();

      setResources(data.resources ?? []);
    } catch (error) {
      console.error("Failed to load resources:", error);
    }
  }

  // Ask the user for permission to share their location.
  function getLocation() {
    if (!navigator.geolocation) {
      setMessage("Location is not supported by this browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const currentLatitude = position.coords.latitude;
        const currentLongitude = position.coords.longitude;

        setLatitude(currentLatitude);
        setLongitude(currentLongitude);

        setMessage("Location shared.");

        loadResources(
          currentLatitude,
          currentLongitude
        );
      },
      () => {
        setMessage("Location was not shared.");
      }
    );
  }

  // Submit a new check-in.
  async function submitCheckIn() {
    if (moodScore === null) {
      setMessage("Please choose a mood score first.");
      return;
    }

    try {
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          moodScore,
          note: note || null,
          latitude,
          longitude,
        }),
      });

      if (!response.ok) {
        throw new Error("Check-in failed");
      }

      const data = await response.json();

      setCompliment(data.compliment);
      setMessage("Check-in saved!");
      setShowSafetyMessage(moodScore <= 3);

      setNote("");
      setMoodScore(null);

      const updatedResponse = await fetch("/api/checkins");

      if (updatedResponse.ok) {
        const updatedData = await updatedResponse.json();

        setCheckIns(updatedData.checkIns);
      }
    } catch (error) {
      console.error(error);

      setMessage("Something went wrong. Please try again.");
    }
  }








  return (
<main className="min-h-screen bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100 px-4 py-10"><div className="mx-auto flex w-full max-w-3xl flex-col items-center">

        {/* Title */}
        <div className="mb-10 text-center">
<div className="mb-3 text-3xl text-[#8299A8]">
  ✦
</div>
  <h1 className="text-5xl font-semibold tracking-tight text-slate-900">
    MindCheck
  </h1>

  <p className="mt-3 text-lg font-light tracking-wide text-slate-500">
    A daily moment to check in with yourself.
  </p>
</div>













<div className="w-full rounded-3xl border border-purple-100 bg-white p-8 shadow-xl shadow-purple-100/50">

  <h2 className="text-2xl font-semibold text-slate-900">
    How are you feeling today?
  </h2>

  <p className="mt-1 text-slate-500">
    Choose a number that best represents your mood.
  </p>
        {/* Mood scores */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
            <button
              key={score}
              onClick={() => setMoodScore(score)}
              className={`h-12 w-12 rounded-lg border transition-all ${
                moodScore === score
                  ? "scale-110 bg-black text-white shadow-md"
                  : "bg-white text-black hover:bg-gray-100"
              }`}
            >
              {score}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm text-gray-500">
          1 = lowest, 10 = highest
        </p>

        {/* Note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an optional note..."
          className="mt-6 h-32 w-full rounded-lg border border-gray-300 p-3 text-black"
        />

        {/* Location */}
        <button
          onClick={getLocation}
          className="mt-4 rounded-lg border border-gray-300 px-6 py-3 text-black hover:bg-gray-100"
        >
          Share Location
        </button>

        {/* Submit */}
        <button
          onClick={submitCheckIn}
          className="mt-4 rounded-lg bg-black px-6 py-3 text-white transition-all hover:scale-105 hover:bg-gray-800 active:scale-95"
        >
          Submit Check-In
        </button>

        {/* Message */}
        {message && (
          <p className="mt-4 text-gray-700">
            {message}
          </p>
        )}

        {/* Compliment */}
        {compliment && (
          <div className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
            <p className="text-sm font-medium text-gray-500">
              A little encouragement
            </p>

            <p className="mt-1 text-gray-700">
              {compliment}
            </p>
          </div>
        )}
</div>

        {/* Support resources */}
        {resources.length > 0 && (
          <div className="mt-6 w-full">
            <h2 className="text-xl font-semibold text-black">
              Support Resources
            </h2>

            <p className="mt-2 text-sm text-gray-600">
              Here are support options available to you.
            </p>

            <div className="mt-4 space-y-3">
              {resources.map((resource) => (
                <div
                  key={`${resource.name}-${resource.type}`}
                  className="rounded-lg border border-gray-200 p-4"
                >
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-700 underline hover:text-blue-900"
                    >
                      {resource.name}
                    </a>
                  ) : (
                    <h3 className="font-semibold text-black">
                      {resource.name}
                    </h3>
                  )}

                  <p className="mt-1 text-sm text-gray-500">
                    {resource.type}
                  </p>

                  <p className="mt-2 text-sm text-gray-700">
                    {resource.description}
                  </p>

                  {resource.phone && (
                    <p className="mt-2 text-sm font-medium text-black">
                      Phone: {resource.phone}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Safety message */}
        {showSafetyMessage && (
          <div className="mt-4 w-full rounded-lg border border-gray-300 bg-gray-50 p-4">
            <p className="font-semibold text-black">
              You may need some extra support right now.
            </p>

            <p className="mt-2 text-sm text-gray-600">
              Consider reaching out to a trusted adult, friend,
              family member, counselor, or another person you trust.
            </p>
          </div>
        )}

        {/* Mood Summary */}
        <div className="mt-8 w-full">
          <h2 className="text-xl font-semibold text-black">
            Mood Summary
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Average
              </p>

              <p className="mt-1 text-2xl font-semibold text-black">
                {averageMood}
              </p>
            </div>

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Highest
              </p>

              <p className="mt-1 text-2xl font-semibold text-black">
                {highestMood}
              </p>
            </div>

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Lowest
              </p>

              <p className="mt-1 text-2xl font-semibold text-black">
                {lowestMood}
              </p>
            </div>

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Trend
              </p>

              <p className="mt-1 whitespace-nowrap text-base font-semibold text-black">
                {moodTrend}
              </p>
            </div>

          </div>
        </div>

        {/* Mood History */}
        <div className="mt-8 w-full">
          <h2 className="text-xl font-semibold text-black">
            Mood History
          </h2>

          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <div className="flex h-64 items-end gap-2">
              {checkIns
                .slice()
                .reverse()
                .slice(-10)
                .map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-1 text-xs text-gray-500">
                      {checkIn.moodScore}
                    </span>

                    <div
                      className="w-full rounded-t-md bg-black"
                      style={{
                        height: `${checkIn.moodScore * 10}%`,
                      }}
                    />

                    <span className="mt-2 text-xs text-gray-500">
                      {new Date(
                        checkIn.createdAt
                      ).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Recent Check-Ins */}
        <div className="mt-8 w-full">
          <button
            onClick={() => setShowCheckIns(!showCheckIns)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-xl font-semibold text-black">
              Your Recent Check-Ins
            </h2>

            <span className="text-lg text-gray-500">
              {showCheckIns ? "▲" : "▼"}
            </span>
          </button>

          {showCheckIns && (
            <div className="mt-4 space-y-2">
              {checkIns.length === 0 ? (
                <p className="text-gray-500">
                  No check-ins yet.
                </p>
              ) : (
                checkIns.map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="rounded-lg border border-gray-200 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-black">
                        {checkIn.moodScore}/10
                      </span>

                      <span className="text-sm text-gray-500">
                        {new Date(
                          checkIn.createdAt
                        ).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {checkIn.note && (
                      <p className="mt-1 text-gray-600">
                        {checkIn.note}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}