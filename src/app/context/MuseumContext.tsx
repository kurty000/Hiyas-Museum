import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, getDocs, writeBatch,
  Timestamp, query, orderBy, limit, where
} from "firebase/firestore";
import { onValue, ref as rtdbRef, remove as rtdbRemove } from "firebase/database";
import { db, rtdb } from "../firebase";

export interface SensorData {
  id: string;
  name: string;
  location: string;
  temperature: number;
  humidity: number;
  motionDetected: boolean;
  /** Latest distance reading in cm (same unit as ESP HC-SR04). */
  distanceCm?: number;
  status: "safe" | "warning" | "critical" | "offline";
  lastUpdated: Date;
  tempThreshold: number; // Temperature threshold in °C
  humidityThreshold: number; // Humidity threshold in %
  motionThreshold: number; // 1-10 scale
  distanceThreshold: number; // cm (5–10000) — breach when object is at/closer than this
  archived: boolean; // Soft-delete flag
}

const DISTANCE_CM_MIN = 5;
const DISTANCE_CM_MAX = 10000; // 100 m
const DISTANCE_CM_DEFAULT = 150;

/** Parse ESP/Firestore distance as cm. Returns undefined for timeout/invalid (e.g. 999). */
function parseDistanceCm(rawCm: unknown): number | undefined {
  if (rawCm == null || Number.isNaN(Number(rawCm))) return undefined;
  const cm = Number(rawCm);
  // ESP sketch uses 999 as no-reading sentinel
  if (cm < 0 || cm >= 900) return undefined;
  return cm;
}

/**
 * Normalize threshold to cm.
 * Legacy meter values were often < 5 (e.g. 0.05, 1.5) — convert those ×100.
 */
function normalizeThresholdCm(raw: unknown): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return DISTANCE_CM_DEFAULT;
  const asCm = n > 0 && n < DISTANCE_CM_MIN ? n * 100 : n;
  return Math.min(DISTANCE_CM_MAX, Math.max(DISTANCE_CM_MIN, asCm));
}

/** Derive dashboard status from live readings + website threshold settings (cm only). */
function computeSensorStatus(input: {
  temperature: number;
  humidity: number;
  motionDetected: boolean;
  distanceCm?: number;
  tempThreshold: number;
  humidityThreshold: number;
  distanceThreshold: number; // cm
}): SensorData["status"] {
  const {
    temperature,
    humidity,
    motionDetected,
    distanceCm,
    tempThreshold,
    humidityThreshold,
    distanceThreshold,
  } = input;

  // Breach when object is at or closer than the set cm limit (HCSR proximity)
  const tooClose =
    distanceCm != null && distanceCm <= distanceThreshold;

  if (motionDetected || tooClose) return "critical";

  if (temperature > tempThreshold + 2 || humidity > humidityThreshold + 10) {
    return "critical";
  }

  if (temperature > tempThreshold || humidity > humidityThreshold) {
    return "warning";
  }

  return "safe";
}

export interface Alert {
  id: string;
  type: "environmental" | "security";
  severity: "warning" | "critical";
  message: string;
  sensorId: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  sensorLocation: string;
  temperature: number;
  humidity: number;
  motionDetected: boolean;
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  alertTypes: string[];
  archived: boolean;
}

export interface SystemSettings {
  motionThreshold: number; // 1-10 scale
  distanceThreshold: number; // cm (5–10000)
  motionSensitivity: "low" | "medium" | "high";
  emailAlerts: boolean;
  telegramAlerts: boolean;
  reportingIntervalSeconds: number; // Default 15
  dataRetentionMonths: number; // Default 12
  wifiSSID?: string;
  wifiPassword?: string;
  mqttBroker?: string;
  mqttPort?: string;
  mqttTopic?: string;
}

interface MuseumContextType {
  sensors: SensorData[];
  alerts: Alert[];
  logs: LogEntry[];
  settings: SystemSettings;
  contacts: Contact[];
  updateSettings: (newSettings: SystemSettings) => void;
  updateSensorSettings: (sensorId: string, tempThreshold: number, humidityThreshold: number, motionThreshold: number, distanceThreshold: number) => void;
  acknowledgeAlert: (alertId: string, acknowledgedBy?: string) => void;
  archiveSensor: (sensorId: string) => void;
  deleteSensor: (sensorId: string) => void;
  /** Optional hardwareDeviceId must match Arduino DEVICE_ID (e.g. esp32_gallery_a_1) to link RTDB */
  addSensor: (name: string, location: string, hardwareDeviceId?: string) => void;
  setNavigateToAlerts: (callback: () => void) => void;
  // Contact management
  addContact: (contact: Omit<Contact, 'id' | 'archived'>) => void;
  updateContact: (contact: Contact) => void;
  archiveContact: (id: string) => void;
}

const MuseumContext = createContext<MuseumContextType | undefined>(undefined);

// Default settings used for seeding and fallback
const DEFAULT_SETTINGS: SystemSettings = {
  motionThreshold: 5,
  distanceThreshold: DISTANCE_CM_DEFAULT,
  motionSensitivity: "medium",
  emailAlerts: true,
  telegramAlerts: true,
  reportingIntervalSeconds: 15,
  dataRetentionMonths: 12,
  wifiSSID: "Museum-Secure-WiFi",
  mqttBroker: "mqtt.museum-iot.local",
  mqttPort: "1883",
  mqttTopic: "museum/sensors/+",
};

// ── Firestore Helpers ──────────────────────────────────────────────
// Convert Firestore timestamps to JS Dates when reading a document
const toDate = (val: any): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === 'string') return new Date(val);
  return undefined;
};

// Remove auto-generated demo sensors. Keep only ESP hardware + manually added ones.
async function cleanupDemoSensors() {
  const sensorsSnap = await getDocs(collection(db, "sensors"));
  if (sensorsSnap.empty) return;

  const batch = writeBatch(db);
  let removed = 0;

  sensorsSnap.forEach((sensorDoc) => {
    const data = sensorDoc.data();
    const keep =
      data.hardware === true ||
      data.source === "esp32" ||
      data.source === "manual" ||
      String(sensorDoc.id).startsWith("esp32");

    if (!keep) {
      batch.delete(sensorDoc.ref);
      removed += 1;
    }
  });

  if (removed > 0) {
    await batch.commit();
    console.log(`[CLEANUP] Removed ${removed} demo sensor(s)`);
  }
}

// Seed only global settings if missing — never invent sensors
async function seedFirestoreIfEmpty() {
  await cleanupDemoSensors();

  const settingsSnap = await getDocs(collection(db, "settings"));
  if (settingsSnap.empty) {
    await setDoc(doc(db, "settings", "global"), DEFAULT_SETTINGS);
    console.log("[SEED] Seeded settings document");
  }
}

// ── Provider ──────────────────────────────────────────────────────
export const MuseumProvider = ({ children }: { children: React.ReactNode }) => {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [seeded, setSeeded] = useState(false);
  /** Device IDs currently reporting from ESP32 via RTDB /liveSensors */
  const liveHardwareIdsRef = useRef<Set<string>>(new Set());
  /** Latest ESP readings — always win over static Firestore copies */
  const liveReadingsRef = useRef<Record<string, Partial<SensorData>>>({});
  /** Sensors deleted by admin — ignore ESP/RTDB recreate until removed from this set */
  const deletedSensorIdsRef = useRef<Set<string>>(new Set());
  /** Latest sensors snapshot for threshold lookup during RTDB sync */
  const sensorsRef = useRef<SensorData[]>([]);
  const alertsRef = useRef<Alert[]>([]);
  const publishAlertsRef = useRef<(sensorSnapshot: SensorData[]) => Promise<void>>(
    async () => {}
  );

  const navigateToAlertsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  const mergeLiveOntoSensors = (firestoreSensors: SensorData[]): SensorData[] => {
    const byId = new Map(firestoreSensors.map((s) => [s.id, s]));

    for (const [id, live] of Object.entries(liveReadingsRef.current)) {
      if (deletedSensorIdsRef.current.has(id)) continue;
      const existing = byId.get(id);
      // Keep Firestore settings (thresholds). Only overlay live ESP readings.
      const tempThreshold = existing?.tempThreshold ?? 24;
      const humidityThreshold = existing?.humidityThreshold ?? 60;
      const motionThreshold = existing?.motionThreshold ?? 5;
      const distanceThreshold = existing?.distanceThreshold ?? DISTANCE_CM_DEFAULT;
      const temperature = live.temperature ?? existing?.temperature ?? 20;
      const humidity = live.humidity ?? existing?.humidity ?? 45;
      const motionDetected = live.motionDetected ?? existing?.motionDetected ?? false;
      const distanceCm = live.distanceCm ?? existing?.distanceCm;

      const status = computeSensorStatus({
        temperature,
        humidity,
        motionDetected,
        distanceCm,
        tempThreshold,
        humidityThreshold,
        distanceThreshold,
      });

      byId.set(id, {
        id,
        name: existing?.name || live.name || id,
        location: existing?.location || live.location || "Unknown",
        temperature,
        humidity,
        motionDetected,
        distanceCm,
        status,
        lastUpdated: live.lastUpdated || existing?.lastUpdated || new Date(),
        tempThreshold,
        humidityThreshold,
        motionThreshold,
        distanceThreshold,
        archived: existing?.archived ?? false,
      });
    }

    return Array.from(byId.values());
  };

  // ── 1. Seed Firestore on first mount (never block the UI if seed fails) ──
  useEffect(() => {
    seedFirestoreIfEmpty()
      .catch((err) => console.error("[SEED] Failed (continuing anyway):", err))
      .finally(() => setSeeded(true));
  }, []);

  // ── 2. Real-time listeners (only start after seed completes) ──
  useEffect(() => {
    if (!seeded) return;

    // --- Sensors (Firestore base + live ESP overlay from RTDB) ---
    const unsubSensors = onSnapshot(collection(db, "sensors"), (snap) => {
      const data: SensorData[] = [];
      snap.forEach((d) => {
        const raw = d.data();
          data.push({
          id: d.id,
          name: raw.name || '',
          location: raw.location || '',
          temperature: raw.temperature ?? 20,
          humidity: raw.humidity ?? 45,
          motionDetected: raw.motionDetected ?? false,
          distanceCm:
            raw.distanceCm != null
              ? parseDistanceCm(raw.distanceCm)
              : raw.distanceM != null
                // Legacy Firestore field stored meters — convert to cm
                ? Number(raw.distanceM) * 100
                : undefined,
          status: raw.status || 'safe',
          lastUpdated: toDate(raw.lastUpdated) || new Date(),
          tempThreshold: raw.tempThreshold ?? 24,
          humidityThreshold: raw.humidityThreshold ?? 60,
          motionThreshold: raw.motionThreshold ?? 5,
          distanceThreshold: normalizeThresholdCm(raw.distanceThreshold),
          archived: raw.archived ?? false,
        });
      });
      setSensors(mergeLiveOntoSensors(data));
    });

    // --- Alerts ---
    const alertsQuery = query(collection(db, "alerts"), orderBy("timestamp", "desc"), limit(500));
    const unsubAlerts = onSnapshot(alertsQuery, (snap) => {
      const data: Alert[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        data.push({
          id: d.id,
          type: raw.type,
          severity: raw.severity,
          message: raw.message,
          sensorId: raw.sensorId,
          timestamp: toDate(raw.timestamp) || new Date(),
          acknowledged: raw.acknowledged ?? false,
          acknowledgedBy: raw.acknowledgedBy,
          acknowledgedAt: toDate(raw.acknowledgedAt),
          escalated: raw.escalated ?? false,
          escalatedAt: toDate(raw.escalatedAt),
        });
      });
      setAlerts(data);
    });

    // --- Logs ---
    const logsQuery = query(collection(db, "logs"), orderBy("timestamp", "desc"), limit(1000));
    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      const data: LogEntry[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        data.push({
          id: d.id,
          timestamp: toDate(raw.timestamp) || new Date(),
          sensorLocation: raw.sensorLocation || '',
          temperature: raw.temperature ?? 0,
          humidity: raw.humidity ?? 0,
          motionDetected: raw.motionDetected ?? false,
        });
      });
      setLogs(data);
    });

    // --- Contacts ---
    const unsubContacts = onSnapshot(collection(db, "contacts"), (snap) => {
      const data: Contact[] = [];
      snap.forEach((d) => {
        const raw = d.data();
        data.push({
          id: d.id,
          name: raw.name || '',
          role: raw.role || '',
          email: raw.email || '',
          phone: raw.phone || '',
          alertTypes: raw.alertTypes || [],
          archived: raw.archived ?? false,
        });
      });
      setContacts(data);
    });

    // --- Settings ---
    const unsubSettings = onSnapshot(doc(db, "settings", "global"), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as SystemSettings);
      }
    });

    // --- Deleted sensor blocklist (stops ESP from recreating deleted sensors) ---
    const unsubDeleted = onSnapshot(collection(db, "deletedSensors"), (snap) => {
      const blocked = new Set<string>();
      snap.forEach((d) => blocked.add(d.id));
      deletedSensorIdsRef.current = blocked;
      // Drop any live overlays for blocked devices
      for (const id of blocked) {
        delete liveReadingsRef.current[id];
        liveHardwareIdsRef.current.delete(id);
      }
      setSensors((prev) => prev.filter((s) => !blocked.has(s.id)));
    });

    return () => {
      unsubSensors();
      unsubAlerts();
      unsubLogs();
      unsubContacts();
      unsubSettings();
      unsubDeleted();
    };
  }, [seeded]);

  // ── 2b. ESP32 live readings from RTDB /liveSensors ─────────────
  // Shows on the dashboard immediately, and mirrors into Firestore when allowed.
  useEffect(() => {
    if (!seeded) return;

    const liveRef = rtdbRef(rtdb, "liveSensors");
    const unsubLive = onValue(
      liveRef,
      (snap) => {
        const val = snap.val() as Record<string, any> | null;
        const ids = new Set<string>();
        const mirrors: Array<{ deviceId: string; payload: Record<string, unknown> }> = [];

        if (val) {
          for (const [deviceId, raw] of Object.entries(val)) {
            if (!raw || typeof raw !== "object") continue;

            // Admin deleted this device — ignore ESP/RTDB (do not recreate in UI/Firestore)
            if (deletedSensorIdsRef.current.has(deviceId)) {
              delete liveReadingsRef.current[deviceId];
              continue;
            }

            ids.add(deviceId);

            const temperature = Number(raw.temperature ?? 20);
            const humidity = Number(raw.humidity ?? 45);
            const motionDetected = Boolean(raw.motionDetected);
            // ESP already sends cm — keep cm everywhere (no meter conversion)
            const distanceCm = parseDistanceCm(raw.distanceCm);

            // Live overlay: readings only — never overwrite user threshold settings
            const livePartial: Partial<SensorData> = {
              name: raw.name || deviceId,
              location: raw.location || "Unknown",
              temperature,
              humidity,
              motionDetected,
              distanceCm,
              lastUpdated: new Date(),
            };

            liveReadingsRef.current[deviceId] = livePartial;

            const known = sensorsRef.current.find((s) => s.id === deviceId);
            const status = computeSensorStatus({
              temperature,
              humidity,
              motionDetected,
              distanceCm,
              tempThreshold: known?.tempThreshold ?? 24,
              humidityThreshold: known?.humidityThreshold ?? 60,
              distanceThreshold: known?.distanceThreshold ?? DISTANCE_CM_DEFAULT,
            });

            mirrors.push({
              deviceId,
              payload: {
                temperature,
                humidity,
                motionDetected,
                distanceCm: distanceCm ?? null,
                status,
                lastUpdated: Timestamp.now(),
                hardware: true,
                source: "esp32",
                archived: false,
                name: raw.name || deviceId,
                location: raw.location || "Unknown",
              },
            });
          }
        }

        liveHardwareIdsRef.current = ids;

        // Update UI immediately from RTDB — do NOT wait for Firestore writes
        setSensors((prev) => {
          const merged = mergeLiveOntoSensors(prev);
          queueMicrotask(() => {
            void publishAlertsRef.current(merged);
          });
          return merged;
        });

        // Mirror to Firestore in the background (persistence only)
        for (const { deviceId, payload } of mirrors) {
          void setDoc(doc(db, "sensors", deviceId), payload, { merge: true }).catch(
            (err) => console.error("[LIVE] Firestore mirror failed for", deviceId, err)
          );
        }
      },
      (err) => {
        console.error("[LIVE] RTDB /liveSensors read failed:", err);
        toast.error("Cannot read live ESP data from Realtime Database. Check RTDB rules.");
      }
    );

    return () => unsubLive();
  }, [seeded]);

  // ── 3. Automated Dispatch Simulation (unchanged logic) ────────
  const dispatchAlert = (alert: Alert) => {
    const relevantContacts = contacts.filter((c: Contact) =>
      !c.archived &&
      (c.alertTypes.includes(alert.type) || (alert.severity === 'critical' && c.alertTypes.includes('critical')))
    );

    if (relevantContacts.length === 0) return;

    if (settings.telegramAlerts) {
      console.log(`[TELEGRAM DISPATCH] Sending to ${relevantContacts.length} contacts: ${alert.message}`);
      toast.success(`Telegram notification sent to ${relevantContacts.length} staff members.`);
    }

    if (settings.emailAlerts) {
      console.log(`[EMAIL DISPATCH] Sending to ${relevantContacts.length} contacts: ${alert.message}`);
    }
  };

  // ── 4. Hardware Trigger Simulation ────────────────────────────
  const triggerBuzzer = (sensorName: string) => {
    console.log(`[HARDWARE BUZZER] ALARM ACTIVATED AT ${sensorName}`);
    toast.error(`🔊 LOCAL BUZZER ACTIVATED: Security Breach at ${sensorName}`, {
      duration: 10000,
      className: 'bg-red-600 text-white font-bold',
    });
  };

  // ── 5. Check sensors and generate alerts ──────────────────────
  const checkSensorsForAlerts = (sensorData: SensorData[]): Omit<Alert, 'id'>[] => {
    const newAlerts: Omit<Alert, 'id'>[] = [];

    let motionAlertCount = 0;
    const maxMotionAlerts = 2;

    sensorData.filter(s => !s.archived).forEach((sensor) => {
      // Temperature alerts
      if (sensor.temperature > sensor.tempThreshold) {
        newAlerts.push({
          type: "environmental",
          severity: sensor.temperature > sensor.tempThreshold + 2 ? "critical" : "warning",
          message: `High Temperature: ${sensor.temperature}°C exceeds threshold of ${sensor.tempThreshold}°C at ${sensor.name}`,
          sensorId: sensor.id,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
        });
      }

      // Humidity alerts
      if (sensor.humidity > sensor.humidityThreshold) {
        newAlerts.push({
          type: "environmental",
          severity: sensor.humidity > sensor.humidityThreshold + 10 ? "critical" : "warning",
          message: `High Humidity: ${sensor.humidity}% exceeds threshold of ${sensor.humidityThreshold}% at ${sensor.name}`,
          sensorId: sensor.id,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
        });
      }

      // Motion alerts
      if (sensor.motionDetected && motionAlertCount < maxMotionAlerts) {
        newAlerts.push({
          type: "security",
          severity: "critical",
          message: `⚠️ PROXIMITY BREACH: Visitor touched artifact at ${sensor.name}`,
          sensorId: sensor.id,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
        });
        motionAlertCount++;
      }

      // Distance: breach when at or closer than set cm limit
      const limitCm = sensor.distanceThreshold;
      const distCm = sensor.distanceCm;
      if (
        distCm != null &&
        distCm <= limitCm &&
        motionAlertCount < maxMotionAlerts
      ) {
        newAlerts.push({
          type: "security",
          severity: "critical",
          message: `⚠️ PROXIMITY BREACH: Object at ${distCm.toFixed(1)} cm (limit ${limitCm.toFixed(0)} cm) at ${sensor.name}`,
          sensorId: sensor.id,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
        });
        motionAlertCount++;
      }
    });

    return newAlerts;
  };

  const publishAlerts = async (sensorSnapshot: SensorData[]) => {
    const candidates = checkSensorsForAlerts(sensorSnapshot);
    if (candidates.length === 0) return;

    const recentAlertKeys = new Set(
      alertsRef.current
        .filter((a) => Date.now() - a.timestamp.getTime() < 60000)
        .map((a) => `${a.sensorId}-${a.type}-${a.message.slice(0, 24)}`)
    );

    const uniqueNewAlerts = candidates.filter((alert) => {
      const key = `${alert.sensorId}-${alert.type}-${alert.message.slice(0, 24)}`;
      return !recentAlertKeys.has(key);
    });

    for (const alert of uniqueNewAlerts) {
      try {
        const alertRef = await addDoc(collection(db, "alerts"), {
          ...alert,
          timestamp: Timestamp.fromDate(alert.timestamp),
        });
        const fullAlert: Alert = { ...alert, id: alertRef.id };
        dispatchAlert(fullAlert);

        if (alert.type === "security" && alert.severity === "critical") {
          const sensor = sensorSnapshot.find((s) => s.id === alert.sensorId);
          if (sensor) triggerBuzzer(sensor.name);
        }

        if (alert.severity === "critical") {
          toast.error(alert.message, {
            duration: 5000,
            action: {
              label: "View Alert",
              onClick: () => {
                if (navigateToAlertsRef.current) navigateToAlertsRef.current();
                else window.location.href = "/dashboard/alerts";
              },
            },
          });
        } else {
          toast.warning(alert.message, { duration: 4000 });
        }

        await addDoc(collection(db, "logs"), {
          timestamp: Timestamp.now(),
          sensorLocation:
            sensorSnapshot.find((s) => s.id === alert.sensorId)?.location || "Unknown",
          temperature:
            sensorSnapshot.find((s) => s.id === alert.sensorId)?.temperature || 0,
          humidity:
            sensorSnapshot.find((s) => s.id === alert.sensorId)?.humidity || 0,
          motionDetected:
            sensorSnapshot.find((s) => s.id === alert.sensorId)?.motionDetected || false,
        });
      } catch (err) {
        console.error("[ALERT] Failed to publish alert:", err);
      }
    }
  };

  publishAlertsRef.current = publishAlerts;

  // ── 6. Alert escalation check — escalate unacknowledged alerts after 15 min ──
  useEffect(() => {
    if (!seeded) return;
    const escalationInterval = setInterval(async () => {
      const now = Date.now();
      const ESCALATION_THRESHOLD_MS = 15 * 60 * 1000;

      for (const alert of alerts) {
        if (
          !alert.acknowledged &&
          !alert.escalated &&
          now - alert.timestamp.getTime() > ESCALATION_THRESHOLD_MS
        ) {
          toast.warning(`🚨 ESCALATED: ${alert.message}`, { duration: 8000 });
          await updateDoc(doc(db, "alerts", alert.id), {
            escalated: true,
            escalatedAt: Timestamp.now(),
          });
        }
      }
    }, 30_000);

    return () => clearInterval(escalationInterval);
  }, [seeded, alerts]);

  // ── 7. Simulation: periodic sensor updates → Firestore (Option B) ─
  useEffect(() => {
    if (!seeded || sensors.length === 0) return;

    const updateIntervalMs = settings.reportingIntervalSeconds * 1000;

    const interval = setInterval(async () => {
      const batch = writeBatch(db);
      const updatedSensors: SensorData[] = [];

      sensors.forEach((sensor) => {
        if (sensor.archived) {
          updatedSensors.push(sensor);
          return;
        }

        // Do not simulate over real ESP32 hardware sensors
        if (liveHardwareIdsRef.current.has(sensor.id)) {
          updatedSensors.push(sensor);
          return;
        }

        const tempChange = (Math.random() - 0.5) * 0.5;
        const humChange = (Math.random() - 0.5) * 2;
        const newTemp = parseFloat((sensor.temperature + tempChange).toFixed(1));
        const newHum = parseFloat(Math.max(0, Math.min(100, sensor.humidity + humChange)).toFixed(1));
        const motionDetected = Math.random() > 0.99;

        let status: "safe" | "warning" | "critical" | "offline" = "safe";
        if (motionDetected) {
          status = "critical";
        } else if (newTemp > sensor.tempThreshold || newHum > sensor.humidityThreshold) {
          status = "warning";
        }
        if (Math.random() > 0.995) {
          status = "offline";
        }

        const updatedSensor = {
          ...sensor,
          temperature: status === 'offline' ? sensor.temperature : newTemp,
          humidity: status === 'offline' ? sensor.humidity : newHum,
          motionDetected,
          status,
          lastUpdated: new Date(),
        };

        updatedSensors.push(updatedSensor);

        // Write updated sensor to Firestore
        const sensorRef = doc(db, "sensors", sensor.id);
        batch.update(sensorRef, {
          temperature: updatedSensor.temperature,
          humidity: updatedSensor.humidity,
          motionDetected: updatedSensor.motionDetected,
          status: updatedSensor.status,
          lastUpdated: Timestamp.now(),
        });
      });

      try {
        await batch.commit();
      } catch (error) {
        console.error("[SIMULATION] Error writing sensor updates:", error);
        return;
      }

      await publishAlerts(updatedSensors);
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [seeded, sensors.length, settings.reportingIntervalSeconds, contacts]);

  // ── Actions (write to Firestore) ──────────────────────────────
  const updateSettings = async (newSettings: SystemSettings) => {
    try {
      await setDoc(doc(db, "settings", "global"), newSettings);
      toast.success("Settings updated successfully");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Failed to update settings");
    }
  };

  const updateSensorSettings = async (sensorId: string, tempThreshold: number, humidityThreshold: number, motionThreshold: number, distanceThreshold: number) => {
    try {
      const clampedDistance = normalizeThresholdCm(distanceThreshold);
      await updateDoc(doc(db, "sensors", sensorId), {
        tempThreshold, humidityThreshold, motionThreshold, distanceThreshold: clampedDistance
      });
      // Keep UI thresholds even while live ESP readings keep streaming
      setSensors((prev) =>
        prev.map((s) =>
          s.id === sensorId
            ? { ...s, tempThreshold, humidityThreshold, motionThreshold, distanceThreshold: clampedDistance }
            : s
        )
      );
      toast.success("Sensor settings updated successfully");
    } catch (error) {
      console.error("Error updating sensor settings:", error);
      toast.error("Failed to update sensor settings");
    }
  };

  const acknowledgeAlert = async (alertId: string, acknowledgedBy?: string) => {
    try {
      await updateDoc(doc(db, "alerts", alertId), {
        acknowledged: true,
        acknowledgedBy: acknowledgedBy || 'System',
        acknowledgedAt: Timestamp.now(),
      });
      toast.success("Alert acknowledged");
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      toast.error("Failed to acknowledge alert");
    }
  };

  const archiveSensor = async (sensorId: string) => {
    try {
      await updateDoc(doc(db, "sensors", sensorId), { archived: true });
      toast.success("Sensor archived. Historical data and alerts are preserved.");
    } catch (error) {
      console.error("Error archiving sensor:", error);
      toast.error("Failed to archive sensor");
    }
  };

  const deleteSensor = async (sensorId: string) => {
    try {
      // Block ESP/RTDB from recreating this sensor
      deletedSensorIdsRef.current.add(sensorId);
      await setDoc(doc(db, "deletedSensors", sensorId), {
        deletedAt: Timestamp.now(),
        reason: "admin_delete",
      });

      await deleteDoc(doc(db, "sensors", sensorId));
      delete liveReadingsRef.current[sensorId];
      liveHardwareIdsRef.current.delete(sensorId);
      setSensors((prev) => prev.filter((s) => s.id !== sensorId));

      try {
        await rtdbRemove(rtdbRef(rtdb, `liveSensors/${sensorId}`));
      } catch (rtdbErr) {
        console.warn("[DELETE] RTDB cleanup skipped:", rtdbErr);
      }
      toast.success("Sensor deleted. ESP will not bring it back.");
    } catch (error) {
      console.error("Error deleting sensor:", error);
      toast.error("Failed to delete sensor");
    }
  };

  const addSensor = async (name: string, location: string, hardwareDeviceId?: string) => {
    try {
      const deviceId = hardwareDeviceId?.trim();
      const payload = {
        name,
        location,
        temperature: 20,
        humidity: 45,
        motionDetected: false,
        status: "safe" as const,
        lastUpdated: Timestamp.now(),
        tempThreshold: 24,
        humidityThreshold: 60,
        motionThreshold: settings.motionThreshold,
        distanceThreshold: settings.distanceThreshold,
        archived: false,
        hardware: Boolean(deviceId),
        source: deviceId ? "esp32" : "manual",
      };

      if (deviceId) {
        // Re-link to ESP: must match Arduino DEVICE_ID and RTDB /liveSensors/{id}
        deletedSensorIdsRef.current.delete(deviceId);
        try {
          await deleteDoc(doc(db, "deletedSensors", deviceId));
        } catch {
          /* may not exist */
        }
        await setDoc(doc(db, "sensors", deviceId), payload, { merge: true });
        toast.success(`Sensor linked to hardware ID "${deviceId}"`);
      } else {
        await addDoc(collection(db, "sensors"), payload);
        toast.success("Sensor added (not linked to ESP — add a Hardware Device ID to connect)");
      }
    } catch (error) {
      console.error("Error adding sensor:", error);
      toast.error("Failed to add sensor");
    }
  };

  const setNavigateToAlerts = (callback: () => void) => {
    navigateToAlertsRef.current = callback;
  };

  const addContact = async (contact: Omit<Contact, 'id' | 'archived'>) => {
    try {
      await addDoc(collection(db, "contacts"), {
        ...contact,
        archived: false,
      });
      toast.success("Contact added successfully");
    } catch (error) {
      console.error("Error adding contact:", error);
      toast.error("Failed to add contact");
    }
  };

  const updateContact = async (contact: Contact) => {
    try {
      const { id, ...data } = contact;
      await updateDoc(doc(db, "contacts", id), data);
      toast.success("Contact updated successfully");
    } catch (error) {
      console.error("Error updating contact:", error);
      toast.error("Failed to update contact");
    }
  };

  const archiveContact = async (id: string) => {
    try {
      await updateDoc(doc(db, "contacts", id), { archived: true });
      toast.success("Contact archived. Historical records are preserved.");
    } catch (error) {
      console.error("Error archiving contact:", error);
      toast.error("Failed to archive contact");
    }
  };

  return (
    <MuseumContext.Provider
      value={{
        sensors,
        alerts,
        logs,
        settings,
        contacts,
        updateSettings,
        updateSensorSettings,
        acknowledgeAlert,
        archiveSensor,
        deleteSensor,
        addSensor,
        setNavigateToAlerts,
        addContact,
        updateContact,
        archiveContact,
      }}
    >
      {children}
    </MuseumContext.Provider>
  );
};

export const useMuseum = () => {
  const context = useContext(MuseumContext);
  if (context === undefined) {
    throw new Error("useMuseum must be used within a MuseumProvider");
  }
  return context;
};
