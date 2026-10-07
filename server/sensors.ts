import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const app =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });

const firestore = getFirestore(app);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  const apiKey = req.headers["x-api-key"];

  if (apiKey !== process.env.SENSOR_API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
    });
  }

  try {
    const {
      deviceId,
      name,
      location,
      temperature,
      humidity,
      motionDetected,
      distanceCm,
      status,
    } = req.body;

    if (!deviceId) {
      return res.status(400).json({
        error: "deviceId is required",
      });
    }

    await firestore.collection("sensors").doc(deviceId).set(
      {
        name: name || deviceId,
        location: location || "Unknown",
        temperature: Number(temperature) || 0,
        humidity: Number(humidity) || 0,
        motionDetected: Boolean(motionDetected),
        distanceCm: Number(distanceCm) || 0,
        status: status || "safe",
        lastUpdated: new Date(),
        archived: false,
      },
      { merge: true }
    );

    return res.status(200).json({
      success: true,
      message: "Sensor data saved",
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to save sensor data",
    });
  }
}
