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

// Your computer's local network address.
// Keep the web backend running on port 3000.
const API_BASE_URL = "http://192.168.1.151:3000";

const SESSION_KEY = "mindcheck_session_token";

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
  const [moodScore, setMoodScore] =
    useState<number | null>(null);

  const [note, setNote] = useState("");

  const [latitude, setLatitude] =
    useState<number | null>(null);

  const [longitude, setLongitude] =
    useState<number | null>(null);

  const [message, setMessage] = useState("");

  const [compliment, setCompliment] =
    useState("");

  const [resources, setResources] =
    useState<Resource[]>([]);

  const [checkIns, setCheckIns] =
    useState<CheckIn[]>([]);

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [loadingCheckIns, setLoadingCheckIns] =
    useState(false);

  const [submitting, setSubmitting] =
    useState(false);

  const [authenticating, setAuthenticating] =
    useState(true);

  const [showSafetyMessage, setShowSafetyMessage] =
    useState(false);

  /*
   * Get the saved mobile session token.
   *
   * If there isn't one, create a new anonymous
   * session through the backend.
   */
  useEffect(() => {
    initializeSession();
  }, []);

  async function initializeSession() {
    try {
      setAuthenticating(true);

      // Check whether this phone already has a session.
      const existingToken =
        await SecureStore.getItemAsync(
          SESSION_KEY
        );

      if (existingToken) {
        // We already have a token.
        await loadCheckIns(existingToken);
        return;
      }

      // No token yet.
      // Create an anonymous account/session.
      const response = await fetch(
        `${API_BASE_URL}/api/auth/anonymous`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          "Failed to create anonymous session."
        );
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error(
          "The server did not return a session token."
        );
      }

      // Store the token securely on the phone.
      await SecureStore.setItemAsync(
        SESSION_KEY,
        data.token
      );

      // Now load the user's check-ins.
      await loadCheckIns(data.token);
    } catch (error) {
      console.error(
        "Authentication failed:",
        error
      );

      setMessage(
        "Could not connect to MindCheck."
      );
    } finally {
      setAuthenticating(false);
    }
  }

  /*
   * Load the user's previous check-ins.
   */
  async function loadCheckIns(
    token?: string
  ) {
    try {
      setLoadingCheckIns(true);

      const sessionToken =
        token ??
        (await SecureStore.getItemAsync(
          SESSION_KEY
        ));

      if (!sessionToken) {
        return;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/checkins`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      // The token may have expired or become invalid.
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(
          SESSION_KEY
        );

        await initializeSession();

        return;
      }

      if (!response.ok) {
        throw new Error(
          "Failed to load check-ins."
        );
      }

      const data = await response.json();

      setCheckIns(data.checkIns ?? []);
    } catch (error) {
      console.error(
        "Failed to load check-ins:",
        error
      );
    } finally {
      setLoadingCheckIns(false);
    }
  }

  /*
   * Ask the user for permission to share
   * their location.
   */
  async function getLocation() {
    try {
      setLoadingLocation(true);
      setMessage("");

      const {
        status,
      } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setMessage(
          "Location was not shared."
        );

        return;
      }

      const location =
        await Location.getCurrentPositionAsync(
          {
            accuracy:
              Location.Accuracy.Balanced,
          }
        );

      const currentLatitude =
        location.coords.latitude;

      const currentLongitude =
        location.coords.longitude;

      setLatitude(currentLatitude);
      setLongitude(currentLongitude);

      setMessage("Location shared.");

      await loadResources(
        currentLatitude,
        currentLongitude
      );
    } catch (error) {
      console.error(
        "Failed to get location:",
        error
      );

      setMessage(
        "We couldn't get your location."
      );
    } finally {
      setLoadingLocation(false);
    }
  }

  /*
   * Load support resources using the
   * user's permission-based location.
   */
  async function loadResources(
    currentLatitude: number,
    currentLongitude: number
  ) {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/resources?lat=${currentLatitude}&lng=${currentLongitude}`
      );

      if (!response.ok) {
        throw new Error(
          "Failed to load resources."
        );
      }

      const data = await response.json();

      setResources(
        data.resources ?? []
      );
    } catch (error) {
      console.error(
        "Failed to load resources:",
        error
      );

      setMessage(
        "Location was shared, but resources could not be loaded."
      );
    }
  }

  /*
   * Submit a check-in.
   */
  async function submitCheckIn() {
    if (moodScore === null) {
      Alert.alert(
        "Choose a mood",
        "Please select a mood score from 1 to 10."
      );

      return;
    }

    try {
      setSubmitting(true);
      setMessage("");

      // Get the mobile session token.
      const token =
        await SecureStore.getItemAsync(
          SESSION_KEY
        );

      if (!token) {
        // If we somehow lost the session,
        // create a new one.
        await initializeSession();

        throw new Error(
          "No authentication session was available."
        );
      }

      const response = await fetch(
        `${API_BASE_URL}/api/checkins`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            // This is what the backend now accepts.
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            moodScore,
            note: note || null,
            latitude,
            longitude,
          }),
        }
      );

      // If authentication failed, clear the
      // old token and create a new session.
      if (response.status === 401) {
        await SecureStore.deleteItemAsync(
          SESSION_KEY
        );

        setMessage(
          "Your session expired. Please try again."
        );

        await initializeSession();

        return;
      }

      if (!response.ok) {
        const errorData =
          await response.json().catch(
            () => null
          );

        throw new Error(
          errorData?.error ??
            "Check-in submission failed."
        );
      }

      const data = await response.json();

      // Save the encouragement.
      setCompliment(
        data.compliment ?? ""
      );

      setMessage("Check-in saved!");

      // Show additional support information
      // after a low score.
      setShowSafetyMessage(
        moodScore <= 3
      );

      // Clear the form.
      setMoodScore(null);
      setNote("");

      // Refresh check-in history.
      await loadCheckIns(token);
    } catch (error) {
      console.error(
        "Failed to submit check-in:",
        error
      );

      setMessage(
        `Failed to submit check-in: ${
          error instanceof Error
            ? error.message
            : "Unknown error"
        }`
      );
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * Open a support resource.
   */
  async function openResource(
    url?: string
  ) {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error(
        "Could not open resource:",
        error
      );
    }
  }

  /*
   * Mood summary.
   */
  const averageMood =
    checkIns.length > 0
      ? (
          checkIns.reduce(
            (sum, checkIn) =>
              sum + checkIn.moodScore,
            0
          ) / checkIns.length
        ).toFixed(1)
      : "—";

  const highestMood =
    checkIns.length > 0
      ? Math.max(
          ...checkIns.map(
            (checkIn) =>
              checkIn.moodScore
          )
        )
      : "—";

  const lowestMood =
    checkIns.length > 0
      ? Math.min(
          ...checkIns.map(
            (checkIn) =>
              checkIn.moodScore
          )
        )
      : "—";

  let moodTrend = "—";

  if (checkIns.length >= 2) {
    const latestMood =
      checkIns[0].moodScore;

    const previousMood =
      checkIns[1].moodScore;

    if (latestMood > previousMood) {
      moodTrend = "↑ Increasing";
    } else if (
      latestMood < previousMood
    ) {
      moodTrend = "↓ Decreasing";
    } else {
      moodTrend = "→ Stable";
    }
  }

  /*
   * While authentication is being created,
   * show a simple loading screen.
   */
  if (authenticating) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingTitle}>
          MindCheck
        </Text>

        <ActivityIndicator
          size="large"
          style={styles.loadingSpinner}
        />

        <Text style={styles.loadingText}>
          Getting things ready...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          MindCheck
        </Text>

        <Text style={styles.subtitle}>
          How are you feeling today?
        </Text>
      </View>

      {/* Mood selection */}
      <View style={styles.moodContainer}>
        {[
          1, 2, 3, 4, 5,
          6, 7, 8, 9, 10,
        ].map((score) => (
          <Pressable
            key={score}
            onPress={() =>
              setMoodScore(score)
            }
            style={[
              styles.moodButton,
              moodScore === score &&
                styles.selectedMoodButton,
            ]}
          >
            <Text
              style={[
                styles.moodButtonText,
                moodScore === score &&
                  styles.selectedMoodButtonText,
              ]}
            >
              {score}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.helperText}>
        1 = lowest, 10 = highest
      </Text>

      {/* Note */}
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add an optional note..."
        placeholderTextColor="#777"
        multiline
        textAlignVertical="top"
        style={styles.noteInput}
      />

      {/* Location */}
      <Pressable
        onPress={getLocation}
        disabled={loadingLocation}
        style={styles.secondaryButton}
      >
        {loadingLocation ? (
          <ActivityIndicator />
        ) : (
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            {latitude !== null
              ? "Location Shared"
              : "Share Location"}
          </Text>
        )}
      </Pressable>

      {/* Submit */}
      <Pressable
        onPress={submitCheckIn}
        disabled={submitting}
        style={styles.submitButton}
      >
        {submitting ? (
          <ActivityIndicator
            color="#fff"
          />
        ) : (
          <Text
            style={
              styles.submitButtonText
            }
          >
            Submit Check-In
          </Text>
        )}
      </Pressable>

      {/* Message */}
      {message !== "" && (
        <Text style={styles.message}>
          {message}
        </Text>
      )}

      {/* Encouragement */}
      {compliment !== "" && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            A little encouragement
          </Text>

          <Text style={styles.compliment}>
            {compliment}
          </Text>
        </View>
      )}

      {/* Safety message */}
      {showSafetyMessage && (
        <View style={styles.safetyCard}>
          <Text style={styles.safetyTitle}>
            You may need some extra support
            right now.
          </Text>

          <Text style={styles.safetyText}>
            Consider reaching out to a
            trusted adult, friend, family
            member, counselor, or another
            person you trust.
          </Text>
        </View>
      )}

      {/* Support resources */}
      {resources.length > 0 && (
        <View style={styles.section}>
          <Text
            style={styles.sectionTitle}
          >
            Support Resources
          </Text>

          <Text
            style={
              styles.sectionDescription
            }
          >
            Here are support options
            available to you.
          </Text>

          {resources.map(
            (resource) => (
              <View
                key={`${resource.name}-${resource.type}`}
                style={
                  styles.resourceCard
                }
              >
                <Pressable
                  disabled={!resource.url}
                  onPress={() =>
                    openResource(
                      resource.url
                    )
                  }
                >
                  <Text
                    style={[
                      styles.resourceName,
                      resource.url &&
                        styles.resourceLink,
                    ]}
                  >
                    {resource.name}
                  </Text>
                </Pressable>

                <Text
                  style={
                    styles.resourceType
                  }
                >
                  {resource.type}
                </Text>

                <Text
                  style={
                    styles.resourceDescription
                  }
                >
                  {resource.description}
                </Text>

                {resource.phone && (
                  <Text
                    style={
                      styles.resourcePhone
                    }
                  >
                    Phone:{" "}
                    {resource.phone}
                  </Text>
                )}
              </View>
            )
          )}
        </View>
      )}

      {/* Mood Summary */}
      <View style={styles.section}>
        <Text
          style={styles.sectionTitle}
        >
          Mood Summary
        </Text>

        <View style={styles.summaryGrid}>
          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryLabel}
            >
              Average
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {averageMood}
            </Text>
          </View>

          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryLabel}
            >
              Highest
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {highestMood}
            </Text>
          </View>

          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryLabel}
            >
              Lowest
            </Text>

            <Text
              style={styles.summaryValue}
            >
              {lowestMood}
            </Text>
          </View>

          <View
            style={styles.summaryCard}
          >
            <Text
              style={styles.summaryLabel}
            >
              Trend
            </Text>

            <Text
              style={styles.summaryTrend}
            >
              {moodTrend}
            </Text>
          </View>
        </View>
      </View>

      {/* Recent Check-Ins */}
      <View style={styles.section}>
        <Text
          style={styles.sectionTitle}
        >
          Recent Check-Ins
        </Text>

        {loadingCheckIns ? (
          <ActivityIndicator />
        ) : checkIns.length === 0 ? (
          <Text
            style={styles.emptyText}
          >
            No check-ins yet.
          </Text>
        ) : (
          checkIns
            .slice(0, 10)
            .map((checkIn) => (
              <View
                key={checkIn.id}
                style={
                  styles.historyCard
                }
              >
                <View
                  style={
                    styles.historyTop
                  }
                >
                  <Text
                    style={
                      styles.historyMood
                    }
                  >
                    {checkIn.moodScore}/10
                  </Text>

                  <Text
                    style={
                      styles.historyTime
                    }
                  >
                    {new Date(
                      checkIn.createdAt
                    ).toLocaleTimeString(
                      [],
                      {
                        hour: "numeric",
                        minute: "2-digit",
                      }
                    )}
                  </Text>
                </View>

                {checkIn.note && (
                  <Text
                    style={
                      styles.historyNote
                    }
                  >
                    {checkIn.note}
                  </Text>
                )}
              </View>
            ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
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
    paddingTop: 60,
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
    flexDirection: "row",
    flexWrap: "wrap",
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
    backgroundColor: "#000",
  },

  moodButtonText: {
    fontSize: 16,
    color: "#111",
  },

  selectedMoodButtonText: {
    color: "#fff",
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
    textDecorationLine: "underline",
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
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },

  summaryCard: {
    width: "47%",
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
    justifyContent: "space-between",
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