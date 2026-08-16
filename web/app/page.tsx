"use client";
// "use client" tells Next.js: "this file runs in the user's browser,
// not on the server." We need that because this file uses things like
// clicking buttons and asking for the user's location, which only make
// sense in a browser.

import { useEffect, useState } from "react";
// useState = a way to store information that can change (like the mood
//            score the user picked) and have the page update when it changes.
// useEffect = a way to say "when this page first loads, automatically do
//            this thing" (in our case: load past check-ins).

// ---------------------------------------------------------------------
// TYPES
// These blocks (type CheckIn, type Resource) don't run any code. They're
// just a description of "what shape of information should I expect here?"
// Think of them like a label on a box that says what's supposed to be
// inside it, so we don't accidentally put the wrong thing in.
// ---------------------------------------------------------------------

type CheckIn = {
  id: string; // a unique ID for this check-in, like a serial number
  moodScore: number; // the number 1-10 the user picked
  note: string | null; // an optional note the user typed (or nothing/null)
  createdAt: string; // the date/time the check-in was submitted
};

type Resource = {
  name: string; // name of the support resource (e.g. "Crisis Hotline")
  type: string; // what kind of resource it is (e.g. "Hotline", "Counseling")
  phone?: string; // phone number, if there is one (the "?" means optional)
  description: string; // short description of the resource
  url?: string; // a website link, if there is one (optional)
};

// ---------------------------------------------------------------------
// MAIN COMPONENT
// Everything below is the actual "MindCheck" page. In React, a "page"
// is just a function that returns what should be drawn on the screen.
// ---------------------------------------------------------------------

export default function Home() {
  // ---- PIECES OF INFORMATION THE PAGE NEEDS TO REMEMBER ----
  // Each "useState" line below creates one piece of memory for the page.
  // The first name (e.g. "compliment") is the current value.
  // The second name (e.g. "setCompliment") is the function you call to
  // change that value. Whenever you call a "set..." function, React
  // automatically redraws the page with the new value.

  const [compliment, setCompliment] = useState(""); // the kind message shown after checking in
  const [moodScore, setMoodScore] = useState<number | null>(null); // which mood number (1-10) is currently selected
  const [note, setNote] = useState(""); // whatever the user typed in the notes box
  const [message, setMessage] = useState(""); // small status messages (e.g. "Check-in saved!")
  const [showSafetyMessage, setShowSafetyMessage] = useState(false); // whether to show the "you may need support" box

  const [latitude, setLatitude] = useState<number | null>(null); // user's location (north/south), if they shared it
  const [longitude, setLongitude] = useState<number | null>(null); // user's location (east/west), if they shared it

  const [resources, setResources] = useState<Resource[]>([]); // list of nearby support resources
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]); // list of the user's past check-ins
  const [showCheckIns, setShowCheckIns] = useState(false); // whether the "Recent Check-Ins" list is expanded or collapsed

  // ---- CALCULATED VALUES (MOOD SUMMARY STATS) ----
  // These aren't stored with useState because we don't need React to
  // "remember" them separately — they're just math done fresh every time
  // based on the checkIns list above. If checkIns changes, these
  // automatically recalculate the next time the page redraws.

  // Average mood = add up every mood score, divide by how many there are.
  const averageMood =
    checkIns.length > 0
      ? (
          checkIns.reduce(
            (sum, checkIn) => sum + checkIn.moodScore,
            0
          ) / checkIns.length
        ).toFixed(1) // toFixed(1) rounds to one decimal place, e.g. "7.3"
      : "—"; // if there are no check-ins yet, just show a dash

  // Highest mood ever logged.
  const highestMood =
    checkIns.length > 0
      ? Math.max(...checkIns.map((checkIn) => checkIn.moodScore))
      : "—";

  // Lowest mood ever logged.
  const lowestMood =
    checkIns.length > 0
      ? Math.min(...checkIns.map((checkIn) => checkIn.moodScore))
      : "—";

  // Mood trend = is the most recent mood higher, lower, or the same as
  // the one before it? This gives a quick "↑ / ↓ / →" indicator.
  let moodTrend = "—";

  if (checkIns.length >= 2) {
    const latestMood = checkIns[0].moodScore; // most recent check-in
    const previousMood = checkIns[1].moodScore; // the one before that

    if (latestMood > previousMood) {
      moodTrend = "↑ Increasing";
    } else if (latestMood < previousMood) {
      moodTrend = "↓ Decreasing";
    } else {
      moodTrend = "→ Stable";
    }
  }

  // -----------------------------------------------------------------
  // LOAD PAST CHECK-INS WHEN THE PAGE FIRST OPENS
  // -----------------------------------------------------------------
  // useEffect with an empty [] at the end means: "run this once, right
  // when the page first loads, and never again automatically."
  useEffect(() => {
    async function loadCheckIns() {
      try {
        // Ask the server for this user's past check-ins.
        let response = await fetch("/api/checkins");

        // If the server says "401" (not logged in), it means this
        // person doesn't have a session yet. So we create an anonymous
        // one for them automatically, then try loading check-ins again.
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

        // Turn the server's response into usable data and store it.
        const data = await response.json();
        setCheckIns(data.checkIns);
      } catch (error) {
        // If anything above fails, just log it to the browser console
        // instead of crashing the whole page.
        console.error("Failed to load check-ins:", error);
      }
    }

    loadCheckIns();
  }, []);

  // -----------------------------------------------------------------
  // LOAD NEARBY SUPPORT RESOURCES (based on the user's location)
  // -----------------------------------------------------------------
  async function loadResources(
    currentLatitude: number,
    currentLongitude: number
  ) {
    try {
      // Send the coordinates to our server, which looks up nearby
      // resources and sends back a list.
      const response = await fetch(
        `/api/resources?lat=${currentLatitude}&lng=${currentLongitude}`
      );

      if (!response.ok) {
        throw new Error("Failed to load resources");
      }

      const data = await response.json();

      // "?? []" means: if data.resources doesn't exist, use an empty
      // list instead of crashing.
      setResources(data.resources ?? []);
    } catch (error) {
      console.error("Failed to load resources:", error);
    }
  }

  // -----------------------------------------------------------------
  // ASK THE BROWSER FOR THE USER'S LOCATION
  // -----------------------------------------------------------------
  // This only runs when the user clicks the "Share Location" button —
  // it doesn't happen automatically, since location is sensitive info.
  function getLocation() {
    // Not every browser/device supports location sharing.
    if (!navigator.geolocation) {
      setMessage("Location is not supported by this browser.");
      return;
    }

    // This pops up the browser's built-in "Allow this site to know your
    // location?" permission prompt.
    navigator.geolocation.getCurrentPosition(
      // If the user says YES:
      (position) => {
        const currentLatitude = position.coords.latitude;
        const currentLongitude = position.coords.longitude;

        setLatitude(currentLatitude);
        setLongitude(currentLongitude);
        setMessage("Location shared.");

        // Now that we have a location, go fetch resources near it.
        loadResources(currentLatitude, currentLongitude);
      },
      // If the user says NO (or it fails for some other reason):
      () => {
        setMessage("Location was not shared.");
      }
    );
  }

  // -----------------------------------------------------------------
  // SUBMIT A NEW CHECK-IN
  // -----------------------------------------------------------------
  // Runs when the user clicks "Submit Check-In".
  async function submitCheckIn() {
    // Don't let someone submit without picking a mood number first.
    if (moodScore === null) {
      setMessage("Please choose a mood score first.");
      return;
    }

    try {
      // Send the mood score, note, and location (if shared) to the server.
      const response = await fetch("/api/checkins", {
        method: "POST", // POST = "I'm sending/creating new data"
        headers: {
          "Content-Type": "application/json", // tells the server "this is JSON data"
        },
        body: JSON.stringify({
          moodScore,
          note: note || null, // if note is an empty string, save it as null instead
          latitude,
          longitude,
        }),
      });

      if (!response.ok) {
        throw new Error("Check-in failed");
      }

      const data = await response.json();

      // Show the encouraging message the server sent back.
      setCompliment(data.compliment);
      setMessage("Check-in saved!");

      // If the mood score was low (3 or below), show a supportive
      // message pointing them toward help.
      setShowSafetyMessage(moodScore <= 3);

      // Clear the form so it's ready for next time.
      setNote("");
      setMoodScore(null);

      // Re-fetch the check-in list so the new one shows up immediately
      // in the history/summary sections without needing a page refresh.
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

  // -----------------------------------------------------------------
  // WHAT GETS DRAWN ON THE SCREEN
  // -----------------------------------------------------------------
  // Everything from here down is JSX — it looks like HTML, but it's
  // really JavaScript describing what should appear on the page. The
  // className="..." bits are Tailwind CSS: little keyword shortcuts
  // for styling (colors, spacing, rounded corners, etc.) instead of
  // writing separate CSS files.
  return (
    <main className="min-h-screen bg-gradient-to-br from-violet-100 via-indigo-50 to-blue-100 px-4 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
        {/* ---------------- Title / Header ---------------- */}
        <div className="mb-10 text-center">
          <div className="mb-3 text-3xl text-[#8299A8]">✦</div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-900">
            MindCheck
          </h1>

          <p className="mt-3 text-lg font-light tracking-wide text-slate-500">
            A daily moment to check in with yourself.
          </p>
        </div>

        {/* ---------------- Main Check-In Card ---------------- */}
        <div className="w-full rounded-3xl border border-purple-100 bg-white p-8 shadow-xl shadow-purple-100/50">
          <h2 className="text-2xl font-semibold text-slate-900">
            How are you feeling today?
          </h2>

          <p className="mt-1 text-slate-500">
            Choose a number that best represents your mood.
          </p>

          {/* Mood score buttons: one button for each number 1-10. */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
              <button
                key={score} // React needs a unique "key" for each item in a list
                onClick={() => setMoodScore(score)} // clicking sets that number as the chosen mood
                className={`h-12 w-12 rounded-lg border transition-all ${
                  // If this button's number matches the currently selected
                  // mood, make it stand out (black background, bigger).
                  // Otherwise, keep it plain.
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

          {/* Optional note box — updates the "note" memory as you type. */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an optional note..."
            className="mt-6 h-32 w-full rounded-lg border border-gray-300 p-3 text-black"
          />

          {/* Button that asks the browser for the user's location. */}
          <button
            onClick={getLocation}
            className="mt-4 rounded-lg border border-gray-300 px-6 py-3 text-black hover:bg-gray-100"
          >
            Share Location
          </button>

          {/* Button that sends the check-in to the server. */}
          <button
            onClick={submitCheckIn}
            className="mt-4 rounded-lg bg-black px-6 py-3 text-white transition-all hover:scale-105 hover:bg-gray-800 active:scale-95"
          >
            Submit Check-In
          </button>

          {/* Small status message (only shows up if "message" isn't empty). */}
          {message && <p className="mt-4 text-gray-700">{message}</p>}

          {/* Encouraging message from the server (only shows if we have one). */}
          {compliment && (
            <div className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
              <p className="text-sm font-medium text-gray-500">
                A little encouragement
              </p>

              <p className="mt-1 text-gray-700">{compliment}</p>
            </div>
          )}
        </div>

        {/* ---------------- Support Resources ---------------- */}
        {/* This whole block only appears once we actually have resources
            to show (i.e., after the user shares their location). */}
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
                  {/* If the resource has a website link, make the name
                      clickable. Otherwise just show it as plain text. */}
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank" // opens the link in a new browser tab
                      rel="noopener noreferrer" // a security best-practice for external links
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

                  {/* Only show a phone number line if one exists. */}
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

        {/* ---------------- "You may need support" message ---------------- */}
        {/* Only appears after a low mood score (3 or below) is submitted. */}
        {showSafetyMessage && (
          <div className="mt-4 w-full rounded-lg border border-gray-300 bg-gray-50 p-4">
            <p className="font-semibold text-black">
              You may need some extra support right now.
            </p>

            <p className="mt-2 text-sm text-gray-600">
              Consider reaching out to a trusted adult, friend, family
              member, counselor, or another person you trust.
            </p>
          </div>
        )}

        {/* ---------------- Mood Summary (the 4 stat boxes) ---------------- */}
        <div className="mt-8 w-full">
          <h2 className="text-xl font-semibold text-black">Mood Summary</h2>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">Average</p>
              <p className="mt-1 text-2xl font-semibold text-black">
                {averageMood}
              </p>
            </div>

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">Highest</p>
              <p className="mt-1 text-2xl font-semibold text-black">
                {highestMood}
              </p>
            </div>

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">Lowest</p>
              <p className="mt-1 text-2xl font-semibold text-black">
                {lowestMood}
              </p>
            </div>

            <div className="flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-gray-200 p-3 text-center">
              <p className="text-sm text-gray-500">Trend</p>
              <p className="mt-1 whitespace-nowrap text-base font-semibold text-black">
                {moodTrend}
              </p>
            </div>
          </div>
        </div>

        {/* ---------------- Mood History Bar Chart ---------------- */}
        <div className="mt-8 w-full">
          <h2 className="text-xl font-semibold text-black">Mood History</h2>

          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <div className="flex h-64 items-end gap-2">
              {checkIns
                .slice() // makes a copy so we don't change the original list's order
                .reverse() // put oldest first, newest last (left to right on the chart)
                .slice(-10) // only keep the last 10 check-ins, so the chart doesn't get crowded
                .map((checkIn) => (
                  <div
                    key={checkIn.id}
                    className="flex h-full flex-1 flex-col items-center justify-end"
                  >
                    <span className="mb-1 text-xs text-gray-500">
                      {checkIn.moodScore}
                    </span>

                    {/* This is the actual bar. Its height is set directly
                        based on the mood score (score × 10%), so a mood
                        of 10 makes a bar that's 100% tall, a mood of 5
                        makes it 50% tall, etc. */}
                    <div
                      className="w-full rounded-t-md bg-black"
                      style={{
                        height: `${checkIn.moodScore * 10}%`,
                      }}
                    />

                    <span className="mt-2 text-xs text-gray-500">
                      {new Date(checkIn.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* ---------------- Recent Check-Ins (collapsible list) ---------------- */}
        <div className="mt-8 w-full">
          {/* Clicking this header toggles the list open/closed. */}
          <button
            onClick={() => setShowCheckIns(!showCheckIns)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-xl font-semibold text-black">
              Your Recent Check-Ins
            </h2>

            {/* Little arrow that flips depending on open/closed state. */}
            <span className="text-lg text-gray-500">
              {showCheckIns ? "▲" : "▼"}
            </span>
          </button>

          {/* Only render the list at all if it's currently expanded. */}
          {showCheckIns && (
            <div className="mt-4 space-y-2">
              {checkIns.length === 0 ? (
                <p className="text-gray-500">No check-ins yet.</p>
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
                        {new Date(checkIn.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Only show the note line if the user actually wrote one. */}
                    {checkIn.note && (
                      <p className="mt-1 text-gray-600">{checkIn.note}</p>
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