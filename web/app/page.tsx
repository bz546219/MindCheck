"use client";

// Main MindCheck check-in page.

import { useEffect, useState } from "react";

export default function Home() {
  // Stores the compliment returned by the backend.
  const [compliment, setCompliment] = useState("");

  // Stores the currently selected mood score.
  const [moodScore, setMoodScore] = useState<number | null>(null);

  // Stores the optional note.
  const [note, setNote] = useState("");

  // Stores messages such as "Check-in saved!".
  const [message, setMessage] = useState("");

  // Shows the extra support message for very low scores.
  const [showSafetyMessage, setShowSafetyMessage] = useState(false);

  // Stores previous check-ins.
  const [checkIns, setCheckIns] = useState<
    {
      id: string;
      moodScore: number;
      note: string | null;
      createdAt: string;
    }[]
  >([]);

  // Controls whether recent check-ins are expanded.
  const [showCheckIns, setShowCheckIns] = useState(false);

  // Calculate average mood.
  const averageMood =
    checkIns.length > 0
      ? (
          checkIns.reduce(
            (sum, checkIn) => sum + checkIn.moodScore,
            0
          ) / checkIns.length
        ).toFixed(1)
      : "—";

  // Find highest mood.
  const highestMood =
    checkIns.length > 0
      ? Math.max(...checkIns.map((checkIn) => checkIn.moodScore))
      : "—";

  // Find lowest mood.
  const lowestMood =
    checkIns.length > 0
      ? Math.min(...checkIns.map((checkIn) => checkIn.moodScore))
      : "—";

  // Calculate mood trend.
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

  // Load previous check-ins when the page opens.
  useEffect(() => {
    async function loadCheckIns() {
      try {
        const response = await fetch("/api/checkins");

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

  // Submit a new check-in.
  async function submitCheckIn() {
    // Make sure the user selected a mood score.
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
        }),
      });

      if (!response.ok) {
        throw new Error("Check-in failed");
      }

      // Get the check-in response from the backend.
      const data = await response.json();

      // Save the compliment returned by the backend.
      setCompliment(data.compliment);

      // Show the success message.
      setMessage("Check-in saved!");

      // Show the safety message if the mood score is low.
      setShowSafetyMessage(moodScore <= 3);

      // Clear the form.
      setNote("");
      setMoodScore(null);

      // Reload check-ins so the new entry appears immediately.
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
    <main className="min-h-screen bg-white p-8">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">

        {/* Title */}
        <h1 className="text-4xl font-bold text-black">
          MindCheck
        </h1>

        <p className="mt-4 text-gray-600">
          How are you feeling today?
        </p>

        {/* Mood score buttons */}
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

        {/* Optional note */}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an optional note..."
          className="mt-6 h-32 w-full rounded-lg border border-gray-300 p-3 text-black"
        />

        {/* Submit button */}
        <button
          onClick={submitCheckIn}
          className="mt-4 rounded-lg bg-black px-6 py-3 text-white transition-all hover:scale-105 hover:bg-gray-800 active:scale-95"
        >
          Submit Check-In
        </button>

        {/* Result message */}
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

            {/* Average */}
            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Average
              </p>

              <p className="mt-1 text-2xl font-semibold text-black">
                {averageMood}
              </p>
            </div>

            {/* Highest */}
            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Highest
              </p>

              <p className="mt-1 text-2xl font-semibold text-black">
                {highestMood}
              </p>
            </div>

            {/* Lowest */}
            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">
                Lowest
              </p>

              <p className="mt-1 text-2xl font-semibold text-black">
                {lowestMood}
              </p>
            </div>

            {/* Trend */}
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
                    {/* Mood score */}
                    <span className="mb-1 text-xs text-gray-500">
                      {checkIn.moodScore}
                    </span>

                    {/* Bar */}
                    <div
                      className="w-full rounded-t-md bg-black"
                      style={{
                        height: `${checkIn.moodScore * 10}%`,
                      }}
                    />

                    {/* Time */}
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

          {/* Check-ins only appear when expanded */}
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