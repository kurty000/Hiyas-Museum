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
  /** True when linked to ESP/RTDB hardware (eligible for offline detection) */
  hardware?: boolean;
}

/** ESP/RTDB device seen live but not yet registered as a monitored sensor */
export interface DetectedDevice {
  deviceId: string;
  suggestedName: string;
  suggestedLocation: string;
  temperature: number;
  humidity: number;
  motionDetected: boolean;
  distanceCm?: number;
  lastUpdated: Date;
}

export interface RegisterDetectedSensorInput {
  deviceId: string;
  name: string;
  location: string;
  tempThreshold: number;
  humidityThreshold: number;
  motionThreshold: number;
  distanceThreshold: number;
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

/** Stable condition identity for one-notification-per-event alerting */
export type AlertConditionKind = "temperature" | "humidity" | "motion" | "distance" | "offline";

const DEFAULT_OFFLINE_TIMEOUT_SECONDS = 60;
const OFFLINE_CHECK_INTERVAL_MS = 5_000;

/**
 * Wall-clock timestamp from ESP (epoch ms).
 * Ignores small numbers like Arduino millis()-since-boot (those are heartbeats, not dates).
 */
function extractEspTimestampMs(raw: Record<string, unknown>): number | null {
  const t = raw.updatedAt ?? raw.timestamp ?? raw.ts ?? raw.time ?? raw.lastUpdated;
  if (t == null || t === "") return null;
  if (typeof t === "number" && !Number.isNaN(t)) {
    if (t > 1e12) return t; // epoch milliseconds
    if (t > 1e9) return t * 1000; // epoch seconds
    return null; // e.g. millis() since boot — not a wall clock
  }
  if (typeof t === "object" && t !== null && "seconds" in t) {
    const seconds = Number((t as { seconds: number }).seconds);
    if (!Number.isNaN(seconds) && seconds > 1e9) return seconds * 1000;
  }
  const parsed = new Date(String(t)).getTime();
  return Number.isNaN(parsed) || parsed < 1e12 ? null : parsed;
}

/** Changing token so each ESP PUT refreshes last-seen even when readings are unchanged. */
function extractHeartbeatToken(raw: Record<string, unknown>): string | null {
  const t =
    raw.heartbeat ?? raw.seq ?? raw.updatedAt ?? raw.timestamp ?? raw.ts ?? raw.time;
  if (t == null || t === "") return null;
  return String(t);
}

function readingFingerprint(partial: {
  temperature?: number;
  humidity?: number;
  motionDetected?: boolean;
  distanceCm?: number;
}): string {
  return [
    partial.temperature,
    partial.humidity,
    partial.motionDetected,
    partial.distanceCm ?? "",
  ].join("|");
}

export interface Alert {
  id: string;
  type: "environmental" | "security";
  severity: "warning" | "critical";
  message: string;
  sensorId: string;
  /** Which sensor condition this alert event belongs to */
  conditionKind?: AlertConditionKind;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  escalated: boolean;
  escalatedAt?: Date;
}

function alertEventKey(sensorId: string, conditionKind: AlertConditionKind): string {
  return `${sensorId}:${conditionKind}`;
}

/** Infer condition kind for older alerts that predate conditionKind field */
function inferConditionKind(alert: Pick<Alert, "type" | "message" | "conditionKind">): AlertConditionKind | null {
  if (alert.conditionKind) return alert.conditionKind;
  const msg = alert.message || "";
  if (/offline|stopped communicating|no data/i.test(msg)) return "offline";
  if (/high temperature/i.test(msg)) return "temperature";
  if (/high humidity/i.test(msg)) return "humidity";
  if (/object at/i.test(msg) || /distance/i.test(msg) || /limit \d+/i.test(msg)) return "distance";
  if (/proximity|motion|touched/i.test(msg)) return "motion";
  if (alert.type === "security") return "distance";
  return null;
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
  /** Seconds without communication before a registered sensor becomes Offline */
  offlineTimeoutSeconds: number;
  dataRetentionMonths: number; // Default 12
  wifiSSID?: string;
  wifiPassword?: string;
  mqttBroker?: string;
  mqttPort?: string;
  mqttTopic?: string;
}

interface MuseumContextType {
  sensors: SensorData[];
  /** Live RTDB devices that are not registered sensors yet */
  detectedDevices: DetectedDevice[];
  alerts: Alert[];
  logs: LogEntry[];
  settings: SystemSettings;
  contacts: Contact[];
  updateSettings: (newSettings: SystemSettings) => void;
  updateSensorSettings: (sensorId: string, tempThreshold: number, humidityThreshold: number, motionThreshold: number, distanceThreshold: number) => void;
  acknowledgeAlert: (alertId: string, acknowledgedBy?: string) => void;
  archiveSensor: (sensorId: string) => void;
  deleteSensor: (sensorId: string) => void;
  /** Register a detected ESP device as an official monitored sensor */
  registerDetectedSensor: (input: RegisterDetectedSensorInput) => Promise<void>;
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
  offlineTimeoutSeconds: DEFAULT_OFFLINE_TIMEOUT_SECONDS,
  dataRetentionMonths: 12,
  wifiSSID: "Museum-Secure-WiFi",
  mqttBroker: "mqtt.museum-iot.local",
  mqttPort: "1883",
  mqttTopic: "museum/sensors/+",
};

function normalizeOfflineTimeoutSeconds(raw: unknown): number {
  const n = Number(raw);
  if (Number.isNaN(n)) return DEFAULT_OFFLINE_TIMEOUT_SECONDS;
  return Math.min(3600, Math.max(15, Math.round(n)));
}

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
  const [detectedDevices, setDetectedDevices] = useState<DetectedDevice[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [seeded, setSeeded] = useState(false);
  /** Device IDs currently reporting from ESP32 via RTDB /liveSensors */
  const liveHardwareIdsRef = useRef<Set<string>>(new Set());
  /** Latest ESP readings — always win over static Firestore copies */
  const liveReadingsRef = useRef<Record<string, Partial<SensorData>>>({});
  /** Last communication time (ms) per registered hardware sensor — kept after RTDB drop */
  const lastSeenAtRef = useRef<Record<string, number>>({});
  /** Last ESP heartbeat/seq/updatedAt token — detects PUTs when readings are unchanged */
  const lastHeartbeatRef = useRef<Record<string, string>>({});
  /** Wait for first RTDB snapshot before marking Offline (avoids false alerts on load) */
  const rtdbReadyRef = useRef(false);
  /** Sensors deleted by admin — ignore ESP/RTDB recreate until removed from this set */
  const deletedSensorIdsRef = useRef<Set<string>>(new Set());
  /** Latest sensors snapshot for threshold lookup during RTDB sync */
  const sensorsRef = useRef<SensorData[]>([]);
  const settingsRef = useRef<SystemSettings>(settings);
  const alertsRef = useRef<Alert[]>([]);
  const publishAlertsRef = useRef<(sensorSnapshot: SensorData[]) => Promise<void>>(
    async () => {}
  );
  /** Keys currently being written — blocks double notify from overlapping RTDB ticks */
  const publishingAlertKeysRef = useRef<Set<string>>(new Set());

  const navigateToAlertsRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    sensorsRef.current = sensors;
  }, [sensors]);

  useEffect(() => {
    settingsRef.current = {
      ...settings,
      offlineTimeoutSeconds: normalizeOfflineTimeoutSeconds(
        settings.offlineTimeoutSeconds ?? DEFAULT_OFFLINE_TIMEOUT_SECONDS
      ),
    };
  }, [settings]);

  useEffect(() => {
    alertsRef.current = alerts;
  }, [alerts]);

  /** Overlay live ESP readings onto registered sensors only — never invent new sensors */
  const mergeLiveOntoSensors = (firestoreSensors: SensorData[]): SensorData[] => {
    return firestoreSensors.map((existing) => {
      const live = liveReadingsRef.current[existing.id];
      if (!live || deletedSensorIdsRef.current.has(existing.id)) {
        return existing;
      }

      const temperature = live.temperature ?? existing.temperature;
      const humidity = live.humidity ?? existing.humidity;
      const motionDetected = live.motionDetected ?? existing.motionDetected;
      const distanceCm = live.distanceCm ?? existing.distanceCm;

      const status = computeSensorStatus({
        temperature,
        humidity,
        motionDetected,
        distanceCm,
        tempThreshold: existing.tempThreshold,
        humidityThreshold: existing.humidityThreshold,
        distanceThreshold: existing.distanceThreshold,
      });

      return {
        ...existing,
        hardware: true,
        temperature,
        humidity,
        motionDetected,
        distanceCm,
        status,
        lastUpdated: live.lastUpdated || existing.lastUpdated,
      };
    });
  };

  /**
   * Registered hardware → Offline when last ESP heartbeat/reading is older than timeout.
   * Do not treat mere RTDB presence as Online (a dead ESP can leave a stale node).
   * ESP should send a changing `heartbeat` on every PUT (see esp32/hiyas_museum_sensor.ino).
   */
  const applyOfflineStatus = (sensorList: SensorData[]): SensorData[] => {
    // Until RTDB has reported once, keep Firestore statuses (no false Offline flash)
    if (!rtdbReadyRef.current) return sensorList;

    const timeoutMs =
      normalizeOfflineTimeoutSeconds(
        settingsRef.current.offlineTimeoutSeconds ?? DEFAULT_OFFLINE_TIMEOUT_SECONDS
      ) * 1000;
    const now = Date.now();

    return sensorList.map((sensor) => {
      if (sensor.archived) return sensor;

      const currentlyLive = liveHardwareIdsRef.current.has(sensor.id);
      const monitored =
        Boolean(sensor.hardware) ||
        lastSeenAtRef.current[sensor.id] != null ||
        currentlyLive;

      if (!monitored) return sensor;

      const lastSeen = lastSeenAtRef.current[sensor.id];
      // No communication timestamp yet — give a grace window from first monitor moment
      if (lastSeen == null) {
        lastSeenAtRef.current[sensor.id] = now;
        return sensor.status === "offline" ? { ...sensor, status: "safe" } : sensor;
      }

      if (now - lastSeen > timeoutMs) {
        return sensor.status === "offline" ? sensor : { ...sensor, status: "offline" };
      }

      // Fresh heartbeat within timeout — clear Offline (mergeLive sets real status when live)
      if (sensor.status === "offline") {
        return { ...sensor, status: "safe" };
      }

      return sensor;
    });
  };

  const refreshSensorConnectivity = (base: SensorData[]): SensorData[] =>
    applyOfflineStatus(mergeLiveOntoSensors(base));

  /** Persist offline/online transitions and notify once per offline stretch */
  const commitConnectivityUpdate = (next: SensorData[], prev: SensorData[]) => {
    queueMicrotask(() => {
      void publishAlertsRef.current(next);
    });

    for (const sensor of next) {
      const monitored =
        Boolean(sensor.hardware) || lastSeenAtRef.current[sensor.id] != null;
      if (sensor.archived || !monitored) continue;

      const before = prev.find((s) => s.id === sensor.id);
      if (!before || before.status === sensor.status) continue;
      // Only persist offline transitions (and recovery from offline)
      if (sensor.status !== "offline" && before.status !== "offline") continue;

      void setDoc(
        doc(db, "sensors", sensor.id),
        {
          status: sensor.status,
          lastUpdated:
            sensor.status === "offline"
              ? Timestamp.fromDate(sensor.lastUpdated)
              : Timestamp.now(),
        },
        { merge: true }
      ).catch((err) =>
        console.error("[OFFLINE] Failed to persist status for", sensor.id, err)
      );
    }
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
          hardware: Boolean(raw.hardware || raw.source === "esp32"),
        });
      });
      setSensors((prev) => {
        const next = refreshSensorConnectivity(data);
        commitConnectivityUpdate(next, prev);
        return next;
      });
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
          conditionKind: raw.conditionKind,
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
        const rawSettings = snap.data() as SystemSettings;
        setSettings({
          ...DEFAULT_SETTINGS,
          ...rawSettings,
          offlineTimeoutSeconds: normalizeOfflineTimeoutSeconds(
            rawSettings.offlineTimeoutSeconds ?? DEFAULT_OFFLINE_TIMEOUT_SECONDS
          ),
        });
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
  // Registered sensors: overlay live readings + mirror readings to Firestore.
  // Unregistered devices: show under "Detected devices" only — never auto-register.
  useEffect(() => {
    if (!seeded) return;

    const liveRef = rtdbRef(rtdb, "liveSensors");
    const unsubLive = onValue(
      liveRef,
      (snap) => {
        const val = snap.val() as Record<string, any> | null;
        const ids = new Set<string>();
        const detected: DetectedDevice[] = [];
        const mirrors: Array<{ deviceId: string; payload: Record<string, unknown> }> = [];
        const registeredIds = new Set(sensorsRef.current.map((s) => s.id));

        if (val) {
          for (const [deviceId, raw] of Object.entries(val)) {
            if (!raw || typeof raw !== "object") continue;

            ids.add(deviceId);

            const temperature = Number(raw.temperature ?? 20);
            const humidity = Number(raw.humidity ?? 45);
            const motionDetected = Boolean(raw.motionDetected);
            const distanceCm = parseDistanceCm(raw.distanceCm);
            const suggestedName = String(raw.name || deviceId);
            const suggestedLocation = String(raw.location || "Unknown");

            const prevLive = liveReadingsRef.current[deviceId];
            const nextPartial = {
              temperature,
              humidity,
              motionDetected,
              distanceCm,
            };
            const rawObj = raw as Record<string, unknown>;
            const espTs = extractEspTimestampMs(rawObj);
            const heartbeat = extractHeartbeatToken(rawObj);
            const heartbeatChanged =
              heartbeat != null && lastHeartbeatRef.current[deviceId] !== heartbeat;
            if (heartbeat != null) {
              lastHeartbeatRef.current[deviceId] = heartbeat;
            }
            const readingChanged =
              !prevLive ||
              readingFingerprint(prevLive) !== readingFingerprint(nextPartial);
            const wallNow = Date.now();
            const timeoutMs =
              normalizeOfflineTimeoutSeconds(
                settingsRef.current.offlineTimeoutSeconds ?? DEFAULT_OFFLINE_TIMEOUT_SECONDS
              ) * 1000;
            // Prefer a plausible wall-clock ts; ignore stale/future clocks.
            const espTsFresh =
              espTs != null &&
              espTs <= wallNow + 60_000 &&
              espTs >= wallNow - Math.max(timeoutMs, 60_000);
            // Bump last-seen on fresh epoch ts, changing heartbeat/seq, or reading change.
            // Unchanged siblings keep prior lastSeen (parent onValue re-delivers the tree).
            // applyOfflineStatus also treats current RTDB presence as Online.
            const seenAt = espTsFresh
              ? espTs
              : heartbeatChanged || readingChanged
                ? wallNow
                : lastSeenAtRef.current[deviceId] ?? wallNow;
            const lastUpdated = new Date(seenAt);

            const livePartial: Partial<SensorData> = {
              name: suggestedName,
              location: suggestedLocation,
              temperature,
              humidity,
              motionDetected,
              distanceCm,
              lastUpdated,
            };
            liveReadingsRef.current[deviceId] = livePartial;

            // Deleted or never registered → detected only (user must Add Sensor)
            const wasDeleted = deletedSensorIdsRef.current.has(deviceId);
            const isRegistered = !wasDeleted && registeredIds.has(deviceId);

            if (!isRegistered) {
              detected.push({
                deviceId,
                suggestedName,
                suggestedLocation,
                temperature,
                humidity,
                motionDetected,
                distanceCm,
                lastUpdated,
              });
              continue;
            }

            lastSeenAtRef.current[deviceId] = seenAt;

            // Registered only: mirror live readings (keep user name/thresholds in Firestore)
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
                lastUpdated: Timestamp.fromMillis(seenAt),
                hardware: true,
                source: "esp32",
                archived: false,
              },
            });
          }
        }

        // Drop live cache for devices that disappeared from RTDB (keep lastSeenAt for timeout)
        for (const id of Object.keys(liveReadingsRef.current)) {
          if (!ids.has(id)) {
            delete liveReadingsRef.current[id];
            delete lastHeartbeatRef.current[id];
          }
        }

        liveHardwareIdsRef.current = ids;

        // First RTDB pass: start grace clocks for registered hardware missing from RTDB
        if (!rtdbReadyRef.current) {
          const now = Date.now();
          for (const sensor of sensorsRef.current) {
            if (sensor.archived) continue;
            if (!sensor.hardware && !ids.has(sensor.id)) continue;
            if (lastSeenAtRef.current[sensor.id] != null) continue;
            // Absent from live snapshot → begin offline timeout from now (not old Firestore time)
            lastSeenAtRef.current[sensor.id] = now;
          }
          rtdbReadyRef.current = true;
        }

        setDetectedDevices(
          detected.sort((a, b) => a.deviceId.localeCompare(b.deviceId))
        );

        setSensors((prev) => {
          const next = refreshSensorConnectivity(prev);
          commitConnectivityUpdate(next, prev);
          return next;
        });

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

  // ── 2c. Offline watchdog — poll last-seen even when RTDB is quiet ──
  useEffect(() => {
    if (!seeded) return;

    const tick = () => {
      setSensors((prev) => {
        const next = refreshSensorConnectivity(prev);
        const prevStatus = new Map(prev.map((s) => [s.id, s.status]));
        const changed = next.some((s) => prevStatus.get(s.id) !== s.status);
        if (!changed) return prev;
        commitConnectivityUpdate(next, prev);
        return next;
      });
    };

    const interval = setInterval(tick, OFFLINE_CHECK_INTERVAL_MS);
    tick();
    return () => clearInterval(interval);
  }, [seeded, settings.offlineTimeoutSeconds]);

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
  // One notification per alert *event*:
  //   condition becomes true → notify once → stay silent until acknowledged
  //   OR until the condition clears (event ends) → then a new breach can notify again.
  type AlertCandidate = Omit<Alert, "id"> & { conditionKind: AlertConditionKind };

  const collectBreachingConditions = (
    sensorData: SensorData[]
  ): { candidates: AlertCandidate[]; activeKeys: Set<string> } => {
    const candidates: AlertCandidate[] = [];
    const activeKeys = new Set<string>();

    sensorData
      .filter((s) => !s.archived)
      .forEach((sensor) => {
        // Offline stretch: one notification, no stale reading alerts until reconnect
        if (sensor.status === "offline") {
          const kind: AlertConditionKind = "offline";
          activeKeys.add(alertEventKey(sensor.id, kind));
          const timeoutSec = normalizeOfflineTimeoutSeconds(
            settingsRef.current.offlineTimeoutSeconds
          );
          candidates.push({
            type: "environmental",
            severity: "warning",
            message: `Sensor Offline: ${sensor.name} stopped communicating for more than ${timeoutSec}s`,
            sensorId: sensor.id,
            conditionKind: kind,
            timestamp: new Date(),
            acknowledged: false,
            escalated: false,
          });
          return;
        }

        if (sensor.temperature > sensor.tempThreshold) {
          const kind: AlertConditionKind = "temperature";
          activeKeys.add(alertEventKey(sensor.id, kind));
          candidates.push({
            type: "environmental",
            severity:
              sensor.temperature > sensor.tempThreshold + 2 ? "critical" : "warning",
            message: `High Temperature: ${sensor.temperature}°C exceeds threshold of ${sensor.tempThreshold}°C at ${sensor.name}`,
            sensorId: sensor.id,
            conditionKind: kind,
            timestamp: new Date(),
            acknowledged: false,
            escalated: false,
          });
        }

        if (sensor.humidity > sensor.humidityThreshold) {
          const kind: AlertConditionKind = "humidity";
          activeKeys.add(alertEventKey(sensor.id, kind));
          candidates.push({
            type: "environmental",
            severity:
              sensor.humidity > sensor.humidityThreshold + 10 ? "critical" : "warning",
            message: `High Humidity: ${sensor.humidity}% exceeds threshold of ${sensor.humidityThreshold}% at ${sensor.name}`,
            sensorId: sensor.id,
            conditionKind: kind,
            timestamp: new Date(),
            acknowledged: false,
            escalated: false,
          });
        }

        if (sensor.motionDetected) {
          const kind: AlertConditionKind = "motion";
          activeKeys.add(alertEventKey(sensor.id, kind));
          candidates.push({
            type: "security",
            severity: "critical",
            message: `⚠️ PROXIMITY BREACH: Visitor touched artifact at ${sensor.name}`,
            sensorId: sensor.id,
            conditionKind: kind,
            timestamp: new Date(),
            acknowledged: false,
            escalated: false,
          });
        }

        // Distance breach: object at or closer than the configured cm limit
        const limitCm = sensor.distanceThreshold;
        const distCm = sensor.distanceCm;
        if (distCm != null && distCm <= limitCm) {
          const kind: AlertConditionKind = "distance";
          activeKeys.add(alertEventKey(sensor.id, kind));
          candidates.push({
            type: "security",
            severity: "critical",
            message: `⚠️ PROXIMITY BREACH: Object at ${distCm.toFixed(1)} cm (limit ${limitCm.toFixed(0)} cm) at ${sensor.name}`,
            sensorId: sensor.id,
            conditionKind: kind,
            timestamp: new Date(),
            acknowledged: false,
            escalated: false,
          });
        }
      });

    return { candidates, activeKeys };
  };

  const publishAlerts = async (sensorSnapshot: SensorData[]) => {
    const { candidates, activeKeys } = collectBreachingConditions(sensorSnapshot);

    // Open events = alerts whose condition is STILL true.
    // Offline: stay silent for the whole offline stretch (even if acknowledged).
    // Other kinds: silence only while unacknowledged (ack can re-notify if still bad).
    const openEventKeys = new Set<string>();
    for (const existing of alertsRef.current) {
      const kind = inferConditionKind(existing);
      if (!kind) continue;
      const key = alertEventKey(existing.sensorId, kind);
      if (!activeKeys.has(key)) continue;
      if (kind === "offline" || !existing.acknowledged) {
        openEventKeys.add(key);
      }
    }

    // Drop stale in-flight locks (condition cleared, or already stored as open)
    for (const key of [...publishingAlertKeysRef.current]) {
      if (!activeKeys.has(key) || openEventKeys.has(key)) {
        publishingAlertKeysRef.current.delete(key);
      }
    }

    // Only notify for breaches that do not already have an open (unacked) event
    const toPublish = candidates.filter((alert) => {
      const key = alertEventKey(alert.sensorId, alert.conditionKind);
      return !openEventKeys.has(key) && !publishingAlertKeysRef.current.has(key);
    });

    if (toPublish.length === 0) return;

    for (const alert of toPublish) {
      const key = alertEventKey(alert.sensorId, alert.conditionKind);
      // Lock immediately so concurrent RTDB ticks don't double-fire
      publishingAlertKeysRef.current.add(key);
      openEventKeys.add(key);

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
        // Allow retry on next tick if write failed
        publishingAlertKeysRef.current.delete(key);
        openEventKeys.delete(key);
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

        const updatedSensor = {
          ...sensor,
          temperature: newTemp,
          humidity: newHum,
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
      const payload: SystemSettings = {
        ...newSettings,
        offlineTimeoutSeconds: normalizeOfflineTimeoutSeconds(
          newSettings.offlineTimeoutSeconds
        ),
      };
      await setDoc(doc(db, "settings", "global"), payload);
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
      // Offline alerts stay silent until the sensor reconnects (then a new offline event can notify).
      // Other alerts: acknowledging ends the hold; if still breached, a new notify may fire.
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
      delete lastSeenAtRef.current[sensorId];
      delete lastHeartbeatRef.current[sensorId];
      delete liveReadingsRef.current[sensorId];
      setSensors((prev) => prev.filter((s) => s.id !== sensorId));

      try {
        await rtdbRemove(rtdbRef(rtdb, `liveSensors/${sensorId}`));
      } catch (rtdbErr) {
        console.warn("[DELETE] RTDB cleanup skipped:", rtdbErr);
      }
      toast.success("Sensor deleted. It will show as Detected if the device is still online.");
    } catch (error) {
      console.error("Error deleting sensor:", error);
      toast.error("Failed to delete sensor");
    }
  };

  const registerDetectedSensor = async (input: RegisterDetectedSensorInput) => {
    const deviceId = input.deviceId.trim();
    if (!deviceId) {
      toast.error("Missing hardware device ID");
      return;
    }

    const live = liveReadingsRef.current[deviceId];
    const stillDetected = detectedDevices.some((d) => d.deviceId === deviceId);
    if (!live && !stillDetected && !liveHardwareIdsRef.current.has(deviceId)) {
      toast.error("That device is no longer detected. Wait for it to report again.");
      return;
    }

    try {
      deletedSensorIdsRef.current.delete(deviceId);
      try {
        await deleteDoc(doc(db, "deletedSensors", deviceId));
      } catch {
        /* may not exist */
      }

      const temperature = live?.temperature ?? 20;
      const humidity = live?.humidity ?? 45;
      const motionDetected = live?.motionDetected ?? false;
      const distanceCm = live?.distanceCm;
      const distanceThreshold = normalizeThresholdCm(input.distanceThreshold);

      const status = computeSensorStatus({
        temperature,
        humidity,
        motionDetected,
        distanceCm,
        tempThreshold: input.tempThreshold,
        humidityThreshold: input.humidityThreshold,
        distanceThreshold,
      });

      const registeredAt = Date.now();
      lastSeenAtRef.current[deviceId] = registeredAt;

      await setDoc(
        doc(db, "sensors", deviceId),
        {
          name: input.name.trim(),
          location: input.location.trim(),
          temperature,
          humidity,
          motionDetected,
          distanceCm: distanceCm ?? null,
          status,
          lastUpdated: Timestamp.fromMillis(registeredAt),
          tempThreshold: input.tempThreshold,
          humidityThreshold: input.humidityThreshold,
          motionThreshold: input.motionThreshold,
          distanceThreshold,
          archived: false,
          hardware: true,
          source: "esp32",
        },
        { merge: true }
      );

      // Optimistically drop from detected list; RTDB tick will reconcile
      setDetectedDevices((prev) => prev.filter((d) => d.deviceId !== deviceId));
      toast.success(`Sensor "${input.name.trim()}" registered and ready for monitoring`);
    } catch (error) {
      console.error("Error registering detected sensor:", error);
      toast.error("Failed to register sensor");
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
        detectedDevices,
        alerts,
        logs,
        settings,
        contacts,
        updateSettings,
        updateSensorSettings,
        acknowledgeAlert,
        archiveSensor,
        deleteSensor,
        registerDetectedSensor,
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
