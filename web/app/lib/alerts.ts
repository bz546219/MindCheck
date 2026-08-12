// Handles threshold alerts for low mood check-ins.

import { prisma } from "./prisma";
import { Resend } from "resend";

// Create a Resend email client using the API key from .env.
const resend = new Resend(process.env.RESEND_API_KEY);

// Basic support message shown separately from the trusted-contact alert.
const CRISIS_RESOURCES = {
  text:
    "If you're struggling right now, you're not alone. " +
    "Consider reaching out to a trusted adult, friend, family member, counselor, " +
    "or another person you trust.",
};

// Check whether a check-in is low enough to trigger an alert.
export async function maybeSendAlert(checkIn: {
  id: string;
  userId: string;
  moodScore: number;
}) {
  // Check whether this check-in has already triggered an alert.
  const existingCheckIn = await prisma.checkIn.findUnique({
    where: {
      id: checkIn.id,
    },
    select: {
      alertSent: true,
    },
  });

  // Don't send the same alert twice.
  if (existingCheckIn?.alertSent) {
    return {
      sent: false,
      reason: "already_sent",
    };
  }

  // Find the trusted contact connected to this user.
  const contact = await prisma.trustedContact.findUnique({
    where: {
      userId: checkIn.userId,
    },
  });

  // If the user does not have a trusted contact, don't send anything.
  if (!contact) {
    return {
      sent: false,
      reason: "no_trusted_contact",
    };
  }

  // Compare the mood score with the trusted contact's threshold.
  // Example: threshold 3 means scores of 3 or lower trigger the alert.
  if (checkIn.moodScore > contact.thresholdScore) {
    return {
      sent: false,
      reason: "above_threshold",
    };
  }

  // We need an email address in order to send an email.
  if (!contact.email) {
    return {
      sent: false,
      reason: "no_email",
    };
  }

  try {
    // Send the trusted-contact email.
    const { data, error } = await resend.emails.send({
      from: "MindCheck Alerts <onboarding@resend.dev>",
      to: contact.email,
      subject: "MindCheck: a check-in you may want to know about",

      // Keep the message general and avoid including private check-in details.
      text:
        `${contact.name}, someone who listed you as a trusted contact ` +
        `recorded a low wellbeing check-in today. ` +
        `Consider reaching out to them. ` +
        `This is an automated message and not a substitute for direct conversation.`,
    });

    // Log the Resend response for development/testing.
    console.log("[Resend] data:", data);

    // If Resend reports an error, do NOT mark the alert as sent.
    if (error) {
      console.error("[Resend] error:", error);

      // Record the failed attempt.
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

    // Record the successful alert.
    await prisma.alertLog.create({
      data: {
        checkInId: checkIn.id,
        method: "email",
        status: "sent",
      },
    });

    // Mark this check-in so another alert is not sent for it.
    await prisma.checkIn.update({
      where: {
        id: checkIn.id,
      },
      data: {
        alertSent: true,
      },
    });

    // Tell the caller that the alert was successfully sent.
    return {
      sent: true,
    };
  } catch (error) {
    // Log unexpected errors.
    console.error("[Alert Error]:", error);

    // Record the failed alert attempt.
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

// Returns the support message when the app needs it.
export function getCrisisMessage() {
  return CRISIS_RESOURCES.text;
}