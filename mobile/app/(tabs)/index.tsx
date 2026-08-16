import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This is the MOBILE APP version of the MindCheck home screen (built
// with React Native / Expo, so it runs as a real app on a phone instead
// of in a web browser). It does the same core things as the web version
// (page.tsx) — mood check-ins, location-based resources, mood history —
// but it talks to your same backend server over the network, and it
// uses phone-native building blocks (Pressable instead of <button>,
// SecureStore instead of cookies, etc.) instead of web ones.
// -----------------------------------------------------------------------

// This is the address of your backend server on your local WiFi network.
// While developing, your phone and your computer need to be on the same
// WiFi network, and this IP address needs to match your computer's
// current local address. This will need to be updated if your
// computer's local IP changes, and swapped for a real public URL once
// the backend is deployed online.
const API_BASE_URL = "http://192.168.1.151:3000";

// The "key" (like a filename/label) we use to store the session token
// in the phone's secure storage. SecureStore encrypts whatever we save
// under this key, so it's a safe place to keep something sensitive like
// a login token.
const SESSION_KEY = "mindcheck_session_token";

// ---- TYPES ----
// Just like in the web version, these describe the shape of data we
// expect — not code that runs, just labels for what fields exist.
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

export default function HomeScreen() {
  // ---- ALL THE PAGE'S "MEMORY" (state) ----
  // Same idea as the web version's useState calls: each line below is
  // one piece of information the screen remembers and can update.

  const [moodScore, setMoodScore] = useState<number | null>(null); // which number 1-10 is picked
  const [note, setNote] = useState(""); // text typed into the note box
  const [latitude, setLatitude] = useState<number | null>(null); // shared location, if any
  const [longitude, setLongitude] = useState<number | null>(null);
  const [message, setMessage] = useState(""); // small status text (e.g. "Check-in saved!")
  const [compliment, setCompliment] = useState(""); // encouragement message after checking in
  const [resources, setResources] = useState<Resource[]>([]); // support resources list
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]); // past check-ins

  // These extra "loading" flags are mobile-specific niceties: they let
  // us show a little spinner exactly where something is happening
  // (e.g. only on the "Share Location" button while location is being
  // fetched), instead of one big loading state for the whole screen.
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingCheckIns, setLoadingCheckIns] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authenticating, setAuthenticating] = useState(true); // true while we're still setting up the session at app launch
  const [showSafetyMessage, setShowSafetyMessage] = useState(false); // shows the extra support message after a low mood score

  // -----------------------------------------------------------------
  // RUN ONCE WHEN THE APP FIRST OPENS
  // -----------------------------------------------------------------
  useEffect(() => {
    initializeSession();
  }, []);

  // ---- SET UP (OR REUSE) A LOGIN SESSION ----
  // This is the mobile equivalent of the "if response.status === 401,
  // create an anonymous session" logic in the web version — except
  // here, we proactively check for a saved session FIRST, since mobile
  // apps don't have browser cookies to rely on automatically.
  async function initializeSession() {
    try {
      setAuthenticating(true);

      // Check if this phone already has a saved token from a previous
      // time the app was opened (SecureStore persists across app
      // launches, similar to how a cookie persists in a browser).
      const existingToken = await SecureStore.getItemAsync(SESSION_KEY);

      if (existingToken) {
        // We already have a valid-looking token saved — use it to load
        // this user's check-ins and skip creating a new account.
        await loadCheckIns(existingToken);
        return;
      }

      // No token was found, meaning this is a fresh install/first
      // launch. Ask the backend to create a brand-new anonymous
      // account and session for us (this hits the same
      // /api/auth/anonymous endpoint the web app falls back to).
      const response = await fetch(`${API_BASE_URL}/api/auth/anonymous`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to create anonymous session.");
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error("The server did not return a session token.");
      }

      // Save the new token securely on the phone so future app
      // launches can reuse it instead of creating a new account every
      // single time.
      await SecureStore.setItemAsync(SESSION_KEY, data.token);

      // Now that we're logged in, load this (brand new) user's
      // check-ins (which will be empty, but keeps the flow consistent).
      await loadCheckIns(data.token);
    } catch (error) {
      console.error("Authentication failed:", error);
      setMessage("Could not connect to MindCheck.");
    } finally {
      // Whether it succeeded or failed, we're done "authenticating" —
      // stop showing the loading screen either way.
      setAuthenticating(false);
    }
  }

  // ---- LOAD PAST CHECK-INS ----
  async function loadCheckIns(token?: string) {
    try {
      setLoadingCheckIns(true);

      // Use the token that was passed in directly if we have one
      // (e.g. right after creating a session); otherwise, fall back to
      // reading whatever's currently saved in SecureStore. The "??"
      // means "use the left side unless it's null/undefined, then use
      // the right side."
      const sessionToken =
        token ?? (await SecureStore.getItemAsync(SESSION_KEY));

      if (!sessionToken) {
        return;
      }

      // Note: unlike the web version, mobile always sends the token
      // manually as an "Authorization: Bearer ..." header — there's no
      // automatic cookie being attached for us.
      const response = await fetch(`${API_BASE_URL}/api/checkins`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      // If the server says our token is invalid/expired (401), throw
      // it away and start over by creating a fresh anonymous session.
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        await initializeSession();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load check-ins.");
      }

      const data = await response.json();

      // "?? []" = if data.checkIns is missing for some reason, just
      // use an empty list instead of crashing.
      setCheckIns(data.checkIns ?? []);
    } catch (error) {
      console.error("Failed to load check-ins:", error);
    } finally {
      setLoadingCheckIns(false);
    }
  }

  // ---- ASK FOR AND FETCH THE USER'S LOCATION ----
  // Runs when the "Share Location" button is tapped.
  async function getLocation() {
    try {
      setLoadingLocation(true);
      setMessage("");

      // This triggers the phone's native "Allow MindCheck to use your
      // location?" permission prompt.
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setMessage("Location was not shared.");
        return;
      }

      // Ask for the actual coordinates now that we have permission.
      // "Balanced" accuracy is a good middle ground between GPS
      // precision and battery/speed — we don't need pinpoint accuracy
      // just to find general nearby resources.
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const currentLatitude = location.coords.latitude;
      const currentLongitude = location.coords.longitude;

      setLatitude(currentLatitude);
      setLongitude(currentLongitude);
      setMessage("Location shared.");

      // Now go fetch resources based on that location.
      await loadResources(currentLatitude, currentLongitude);
    } catch (error) {
      console.error("Failed to get location:", error);
      setMessage("We couldn't get your location.");
    } finally {
      setLoadingLocation(false);
    }
  }

  // ---- LOAD SUPPORT RESOURCES BASED ON LOCATION ----
  async function loadResources(
    currentLatitude: number,
    currentLongitude: number
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/resources?lat=${currentLatitude}&lng=${currentLongitude}`
      );

      if (!response.ok) {
        throw new Error("Failed to load resources.");
      }

      const data = await response.json();

      setResources(data.resources ?? []);
    } catch (error) {
      console.error("Failed to load resources:", error);
      setMessage("Location was shared, but resources could not be loaded.");
    }
  }

  // ---- SUBMIT A NEW CHECK-IN ----
  async function submitCheckIn() {
    // Don't allow submitting without a mood score. Alert.alert shows a
    // native phone pop-up (different from the web version's simple
    // inline message, since mobile apps typically use native alerts
    // for this kind of thing).
    if (moodScore === null) {
      Alert.alert("Choose a mood", "Please select a mood score from 1 to 10.");
      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      // Grab the saved session token so we can prove who's submitting.
      const token = await SecureStore.getItemAsync(SESSION_KEY);

      if (!token) {
        // We somehow don't have a token (e.g. storage got cleared).
        // Try to recover by creating a fresh session, then stop this
        // submission attempt — the user can tap submit again afterward.
        await initializeSession();
        throw new Error("No authentication session was available.");
      }

      const response = await fetch(`${API_BASE_URL}/api/checkins`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          // This is the Bearer token the backend's check-ins route
          // checks for (see the auth logic we commented earlier).
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify({
          moodScore,
          note: note || null,
          latitude,
          longitude,
        }),
      });

      // If our token got rejected mid-use (e.g. expired right as we
      // submitted), clear it and start a new session so next time
      // works properly.
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(SESSION_KEY);
        setMessage("Your session expired. Please try again.");
        await initializeSession();
        return;
      }

      if (!response.ok) {
        // Try to read a specific error message from the server; if
        // that itself fails to parse, fall back to null instead of
        // throwing a second error.
        const errorData = await response.json().catch(() => null);

        throw new Error(errorData?.error ?? "Check-in submission failed.");
      }

      const data = await response.json();

      setCompliment(data.compliment ?? "");
      setMessage("Check-in saved!");

      // Show the extra support message if the mood was low.
      setShowSafetyMessage(moodScore <= 3);

      // Clear the form for next time.
      setMoodScore(null);
      setNote("");

      // Refresh the check-in list so the new entry shows up right away.
      await loadCheckIns(token);
    } catch (error) {
      console.error("Failed to submit check-in:", error);

      setMessage(
        `Failed to submit check-in: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ---- OPEN A SUPPORT RESOURCE'S LINK ----
  // Tapping a resource with a URL opens it in the phone's browser (or
  // whichever app handles that link, e.g. a phone dialer for tel: links).
  async function openResource(url?: string) {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error("Could not open resource:", error);
    }
  }

  // -----------------------------------------------------------------
  // MOOD SUMMARY CALCULATIONS
  // -----------------------------------------------------------------
  // Identical math to the web version — average, highest, lowest, and
  // whether the trend is up/down/flat compared to the previous entry.
  const averageMood =
    checkIns.length > 0
      ? (
          checkIns.reduce((sum, checkIn) => sum + checkIn.moodScore, 0) /
          checkIns.length
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

  // -----------------------------------------------------------------
  // LOADING SCREEN
  // -----------------------------------------------------------------
  // While we're still figuring out the session (right when the app
  // opens), show a simple centered loading screen instead of the full
  // check-in UI, so the user isn't staring at an empty/broken-looking
  // page for a split second.
  if (authenticating) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingTitle}>MindCheck</Text>

        <ActivityIndicator size="large" style={styles.loadingSpinner} />

        <Text style={styles.loadingText}>Getting things ready...</Text>
      </View>
    );
  }

  // -----------------------------------------------------------------
  // MAIN SCREEN
  // -----------------------------------------------------------------
  // Note: this looks like the web version's JSX, but uses React
  // Native's own building blocks instead of regular HTML tags:
  //   <View>     ≈ like a <div>, a generic box/container
  //   <Text>     ≈ ALL text on mobile must be wrapped in <Text> (unlike
  //                web, you can't just drop plain words in a <View>)
  //   <Pressable> ≈ like a <button>, but built for touch
  //   <ScrollView> ≈ makes the whole screen scrollable, like the page
  //                naturally scrolling in a browser
  // Styling also works differently here: instead of Tailwind
  // className="..." strings, React Native uses JavaScript style
  // objects (defined together at the bottom of this file in
  // "styles"), applied like style={styles.someName}.
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled" // lets you tap buttons without first having to dismiss the keyboard
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MindCheck</Text>
        <Text style={styles.subtitle}>How are you feeling today?</Text>
      </View>

      {/* Mood selection buttons, 1 through 10 */}
      <View style={styles.moodContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
          <Pressable
            key={score}
            onPress={() => setMoodScore(score)}
            style={[
              styles.moodButton,
              // In React Native, style can be an ARRAY of style
              // objects — they get merged together. Here, we always
              // apply the base "moodButton" look, and only add
              // "selectedMoodButton" on top when this is the chosen one.
              moodScore === score && styles.selectedMoodButton,
            ]}
          >
            <Text
              style={[
                styles.moodButtonText,
                moodScore === score && styles.selectedMoodButtonText,
              ]}
            >
              {score}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.helperText}>1 = lowest, 10 = highest</Text>

      {/* Note input box */}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add an optional note..."
        placeholderTextColor="#777"
        multiline // allows multiple lines of text, like a <textarea>
        textAlignVertical="top" // makes text start at the top of the box, not centered vertically
        style={styles.noteInput}
      />

      {/* Share Location button */}
      <Pressable
        onPress={getLocation}
        disabled={loadingLocation} // prevents double-tapping while it's already working
        style={styles.secondaryButton}
      >
        {loadingLocation ? (
          // Show a spinner while location is being fetched...
          <ActivityIndicator />
        ) : (
          // ...otherwise show the button text, which changes once a
          // location has actually been shared.
          <Text style={styles.secondaryButtonText}>
            {latitude !== null ? "Location Shared" : "Share Location"}
          </Text>
        )}
      </Pressable>

      {/* Submit Check-In button */}
      <Pressable
        onPress={submitCheckIn}
        disabled={submitting}
        style={styles.submitButton}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Check-In</Text>
        )}
      </Pressable>

      {/* Status message */}
      {message !== "" && <Text style={styles.message}>{message}</Text>}

      {/* Encouragement message */}
      {compliment !== "" && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>A little encouragement</Text>
          <Text style={styles.compliment}>{compliment}</Text>
        </View>
      )}

      {/* Extra support message, shown after a low mood score */}
      {showSafetyMessage && (
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>
            You may need some extra support right now.
          </Text>

          <Text style={styles.safetyText}>
            Consider reaching out to a trusted adult, friend, family
            member, counselor, or another person you trust.
          </Text>
        </View>
      )}

      {/* Support resources list */}
      {resources.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support Resources</Text>

          <Text style={styles.sectionDescription}>
            Here are support options available to you.
          </Text>

          {resources.map((resource) => (
            <View
              key={`${resource.name}-${resource.type}`}
              style={styles.resourceCard}
            >
              {/* Tapping the name opens its link, if it has one. The
                  Pressable is disabled entirely when there's no URL, so
                  it doesn't look tappable when it isn't. */}
              <Pressable
                disabled={!resource.url}
                onPress={() => openResource(resource.url)}
              >
                <Text
                  style={[
                    styles.resourceName,
                    resource.url && styles.resourceLink,
                  ]}
                >
                  {resource.name}
                </Text>
              </Pressable>

              <Text style={styles.resourceType}>{resource.type}</Text>

              <Text style={styles.resourceDescription}>
                {resource.description}
              </Text>

              {resource.phone && (
                <Text style={styles.resourcePhone}>
                  Phone: {resource.phone}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Mood Summary stat boxes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mood Summary</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Average</Text>
            <Text style={styles.summaryValue}>{averageMood}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Highest</Text>
            <Text style={styles.summaryValue}>{highestMood}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Lowest</Text>
            <Text style={styles.summaryValue}>{lowestMood}</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Trend</Text>
            <Text style={styles.summaryTrend}>{moodTrend}</Text>
          </View>
        </View>
      </View>

      {/* Recent Check-Ins list */}
      {/* Note: unlike the web version, this list is always visible on
          mobile (no expand/collapse toggle) — it just shows the 10 most
          recent entries directly. */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Check-Ins</Text>

        {loadingCheckIns ? (
          <ActivityIndicator />
        ) : checkIns.length === 0 ? (
          <Text style={styles.emptyText}>No check-ins yet.</Text>
        ) : (
          checkIns.slice(0, 10).map((checkIn) => (
            <View key={checkIn.id} style={styles.historyCard}>
              <View style={styles.historyTop}>
                <Text style={styles.historyMood}>
                  {checkIn.moodScore}/10
                </Text>

                <Text style={styles.historyTime}>
                  {new Date(checkIn.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </Text>
              </View>

              {checkIn.note && (
                <Text style={styles.historyNote}>{checkIn.note}</Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

// -----------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------
// This is React Native's version of a CSS file. Instead of writing
// separate .css rules, we define plain JavaScript objects — one per
// "look" we want — and then reference them above with style={styles.x}.
// Values like fontSize, padding, and borderRadius work very similarly
// to their CSS counterparts, just written in JS object form. Grouped
// roughly in the order they appear on screen: loading screen, page
// layout, mood picker, buttons/messages, resource cards, summary grid,
// and check-in history cards.
const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1, // fill the entire available screen space
    backgroundColor: "#fff",
    alignItems: "center", // center content horizontally
    justifyContent: "center", // center content vertically
    padding: 24,
  },

  loadingTitle: {
    fontSize: 34,
    fontWeight: "700",
    color: "#111",
  },

  loadingSpinner: {
    marginTop: 24,
  },

  loadingText: {
    marginTop: 14,
    fontSize: 16,
    color: "#666",
  },

  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  content: {
    padding: 24,
    paddingTop: 60, // extra space at the top so content isn't hidden behind the phone's status bar/notch
    paddingBottom: 50,
  },

  header: {
    alignItems: "center",
    marginBottom: 24,
  },

  title: {
    fontSize: 34,
    fontWeight: "700",
    color: "#111",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 16,
    color: "#555",
  },

  moodContainer: {
    flexDirection: "row", // lay the mood buttons out left-to-right
    flexWrap: "wrap", // let them wrap onto a new row if they don't all fit
    justifyContent: "center",
    gap: 8,
  },

  moodButton: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderColor: "#222",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  selectedMoodButton: {
    backgroundColor: "#000", // overrides the background when this number is picked
  },

  moodButtonText: {
    fontSize: 16,
    color: "#111",
  },

  selectedMoodButtonText: {
    color: "#fff", // switches text to white so it's visible on the black background above
  },

  helperText: {
    textAlign: "center",
    marginTop: 10,
    color: "#777",
    fontSize: 13,
  },

  noteInput: {
    marginTop: 22,
    minHeight: 130,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 9,
    padding: 14,
    fontSize: 16,
    color: "#111",
  },

  secondaryButton: {
    marginTop: 16,
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#bbb",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  secondaryButtonText: {
    fontSize: 16,
    color: "#111",
  },

  submitButton: {
    marginTop: 12,
    minHeight: 50,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },

  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },

  message: {
    textAlign: "center",
    marginTop: 14,
    fontSize: 15,
    color: "#555",
  },

  card: {
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 9,
    backgroundColor: "#fafafa",
  },

  cardLabel: {
    textAlign: "center",
    fontSize: 14,
    color: "#666",
  },

  compliment: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 16,
    color: "#222",
  },

  safetyCard: {
    marginTop: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 9,
    backgroundColor: "#fafafa",
  },

  safetyTitle: {
    fontWeight: "700",
    fontSize: 16,
    color: "#111",
  },

  safetyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: "#555",
  },

  section: {
    width: "100%",
    marginTop: 28,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: "700",
    color: "#111",
  },

  sectionDescription: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
  },

  resourceCard: {
    marginTop: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 9,
    backgroundColor: "#fff",
  },

  resourceName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  resourceLink: {
    color: "#1557a6",
    textDecorationLine: "underline", // only applied when the resource actually has a clickable URL
  },

  resourceType: {
    marginTop: 5,
    fontSize: 13,
    color: "#777",
  },

  resourceDescription: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "#444",
  },

  resourcePhone: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap", // 4 boxes wrap into a 2x2 grid on narrow phone screens
    gap: 10,
    marginTop: 12,
  },

  summaryCard: {
    width: "47%", // just under half-width, so two fit per row with a small gap between
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
  },

  summaryLabel: {
    fontSize: 13,
    color: "#777",
  },

  summaryValue: {
    marginTop: 5,
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
  },

  summaryTrend: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },

  emptyText: {
    marginTop: 12,
    color: "#777",
  },

  historyCard: {
    marginTop: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 9,
  },

  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between", // mood score on the left, time on the right
    alignItems: "center",
  },

  historyMood: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111",
  },

  historyTime: {
    fontSize: 13,
    color: "#777",
  },

  historyNote: {
    marginTop: 6,
    fontSize: 14,
    color: "#555",
  },
});