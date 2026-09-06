// Handles threshold alerts for low mood check-ins.

import { prisma } from "./prisma";
import { Resend } from "resend";

// -----------------------------------------------------------------------
// WHAT IS THIS FILE?
// This file's job is: after someone submits a check-in, decide whether
// it's low enough to notify their "trusted contact" (a person they've
// chosen ahead of time, like a friend or family member), and if so,
// send that person an email. It also keeps a paper trail (alertLog) of
// every attempt, successful or not, so nothing sends silently or twice.
// -----------------------------------------------------------------------

// ---- SET UP THE EMAIL SENDING SERVICE ----
// "Resend" is a third-party service that actually delivers emails for
// us. We hand it our API key (kept secretly in the .env file, never
// written directly in code) so it knows this request is really coming
// from our app.
const resend = new Resend(process.env.RESEND_API_KEY);

// ---- A GENERAL SUPPORT MESSAGE ----
// This is separate from the trusted-contact email below — it's a
// general "you're not alone" message the app can show directly to the
// user themselves (not their contact), if needed elsewhere in the app.
const CRISIS_RESOURCES = {
  text:
    "If you're struggling right now, you're not alone. " +
    "Consider reaching out to a trusted adult, friend, family member, counselor, " +
    "or another person you trust.",
};

// ---- MAIN FUNCTION: DECIDE WHETHER TO SEND AN ALERT, AND SEND IT ----
// This gets called once per check-in, right after it's saved to the
// database. It runs through a series of checks, and stops (returns
// early) the moment it finds a reason NOT to send an alert.
export async function maybeSendAlert(checkIn: {
  id: string;
  userId: string;
  moodScore: number;
}) {
  // ---- CHECK 1: Has an alert already been sent for this exact check-in? ----
  // This guards against accidentally emailing someone twice for the
  // same check-in (e.g. if this function somehow got called more than
  // once). We look up just the "alertSent" flag on this check-in.
  const existingCheckIn = await prisma.checkIn.findUnique({
    where: {
      id: checkIn.id,
    },
    select: {
      alertSent: true,
    },
  });

  if (existingCheckIn?.alertSent) {
    return {
      sent: false,
      reason: "already_sent",
    };
  }

  // ---- CHECK 2: Does this user even have a trusted contact set up? ----
  // Not everyone will have added one. If they haven't, there's nobody
  // to alert, so we stop here.
  const contact = await prisma.trustedContact.findUnique({
    where: {
      userId: checkIn.userId,
    },
  });

  if (!contact) {
    return {
      sent: false,
      reason: "no_trusted_contact",
    };
  }

  // ---- CHECK 3: Is the mood score actually low enough to matter? ----
  // Each user's trusted contact has a "thresholdScore" they agreed on
  // (e.g. "alert me if their mood drops to 3 or below"). If today's
  // mood score is ABOVE that threshold, everything's fine — no alert
  // needed.
  if (checkIn.moodScore > contact.thresholdScore) {
    return {
      sent: false,
      reason: "above_threshold",
    };
  }

  // ---- CHECK 4: Do we actually have an email address to send to? ----
  // We're only sending email alerts here (no text/phone), so if there's
  // no email on file for this contact, we can't proceed.
  if (!contact.email) {
    return {
      sent: false,
      reason: "no_email",
    };
  }

  // If we've made it this far, all the conditions are met: there's a
  // trusted contact, their email is on file, and the mood score is low
  // enough to cross the threshold. Time to actually send the email.
  try {
    // Ask Resend to send the email. This returns either "data" (details
    // about the successful send) or "error" (what went wrong), not both.
    const { data, error } = await resend.emails.send({
      from: "MindCheck Alerts <onboarding@resend.dev>",
      to: contact.email,
      subject: "MindCheck: a check-in you may want to know about",

      // Note: the message is intentionally vague about details (no
      // exact mood score, no notes) to protect the user's privacy —
      // it just nudges the contact to reach out personally.
      text:
        `${contact.name}, someone who listed you as a trusted contact ` +
        `recorded a low wellbeing check-in today. ` +
        `Consider reaching out to them. ` +
        `This is an automated message and not a substitute for direct conversation.`,
    });

    // Print the raw response for our own debugging while developing.
    console.log("[Resend] data:", data);

    // ---- IF RESEND REPORTS A PROBLEM ----
    // Important: if the send failed, we do NOT mark the check-in as
    // "alertSent." That way, if this ever gets retried, it's still
    // eligible to try sending again instead of being silently skipped
    // forever.
    if (error) {
      console.error("[Resend] error:", error);

      // Still log the attempt (as "failed") so there's a record of it.
      await prisma.alertLog.create({
        data: {
          checkInId: checkIn.id,
          method: "email",
          status: "failed",
        },
      });

      return {
        sent: false,
        reason: "send_failed",
      };
    }

    // ---- SUCCESS PATH ----
    // Log that the email genuinely went out.
    await prisma.alertLog.create({
      data: {
        checkInId: checkIn.id,
        method: "email",
        status: "sent",
      },
    });

    // Mark the check-in itself so this exact same check-in never
    // triggers a second email later (this is what Check 1 above looks
    // at).
    await prisma.checkIn.update({
      where: {
        id: checkIn.id,
      },
      data: {
        alertSent: true,
      },
    });

    // Let whoever called this function know it worked.
    return {
      sent: true,
    };
  } catch (error) {
    // This catches anything unexpected — e.g. a network failure talking
    // to Resend, not just a normal "error" response from it.
    console.error("[Alert Error]:", error);

    // Try to log the failure too, but wrap THAT in its own try/catch —
    // if even the logging fails (e.g. database is briefly down), we
    // don't want that secondary failure to crash anything further.
    try {
      await prisma.alertLog.create({
        data: {
          checkInId: checkIn.id,
          method: "email",
          status: "failed",
        },
      });
    } catch (logError) {
      console.error("[Alert Log Error]:", logError);
    }

    return {
      sent: false,
      reason: "send_failed",
    };
  }
}

// ---- SMALL HELPER: RETURN THE GENERAL SUPPORT MESSAGE ----
// Any other part of the app that wants to display the general
// "you're not alone" message (defined near the top of this file) can
// call this instead of retyping the message itself.
export function getCrisisMessage() {
  return CRISIS_RESOURCES.text;
}