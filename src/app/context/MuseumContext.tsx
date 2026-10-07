import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  collection, doc, onSnapshot, addDoc, updateDoc, setDoc, getDocs,
  Timestamp, query, orderBy, limit
} from "firebase/firestore";
import { db } from "../firebase";

export interface SensorData {
  id: string;
  name: string;
  location: string;
  temperature: number;
  humidity: number;
  motionDetected: boolean;
  status: "safe" | "warning" | "critical" | "offline";
  lastUpdated: Date;
  tempThreshold: number;
  humidityThreshold: number;
  motionThreshold: number;
  distanceThreshold: number;
  archived: boolean;
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
  motionThreshold: number;
  distanceThreshold: number;
  motionSensitivity: "low" | "medium" | "high";
  emailAlerts: boolean;
  telegramAlerts: boolean;
  reportingIntervalSeconds: number;
  dataRetentionMonths: number;
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
  updateSensorSettings: (
    sensorId: string,
    tempThreshold: number,
    humidityThreshold: number,
    motionThreshold: number,
    distanceThreshold: number
  ) => void;
  acknowledgeAlert: (alertId: string, acknowledgedBy?: string) => void;
  archiveSensor: (sensorId: string) => void;
  addSensor: (name: string, location: string) => void;
  setNavigateToAlerts: (callback: () => void) => void;
  addContact: (contact: Omit<Contact, "id" | "archived">) => void;
  updateContact: (contact: Contact) => void;
  archiveContact: (id: string) => void;
}

const MuseumContext = createContext<MuseumContextType | undefined>(undefined);

const DEFAULT_SETTINGS: SystemSettings = {
  motionThreshold: 5,
  distanceThreshold: 1.5,
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

const toDate = (val: any): Date | undefined => {
  if (!val) return undefined;
  if (val instanceof Timestamp) return val.toDate();
  if (val instanceof Date) return val;
  if (typeof val === "string") return new Date(val);
  return undefined;
};

const generateInitialSensors = (): Omit<SensorData, "id">[] => {
  const galleries = ["Gallery A", "Gallery B", "Gallery C", "Main Hall"];
  const artifacts = ["Artifact 1", "Artifact 2", "Artifact 3"];
  const sensors: Omit<SensorData, "id">[] = [];

  galleries.forEach((gallery, gIndex) => {
    artifacts.slice(0, gIndex === 0 ? 3 : 2).forEach((artifact) => {
      const temp = 20 + Math.random() * 5;
      const humidity = 45 + Math.random() * 20;

      sensors.push({
        name: `${gallery} - ${artifact}`,
        location: gallery,
        temperature: parseFloat(temp.toFixed(1)),
        humidity: parseFloat(humidity.toFixed(1)),
        motionDetected: false,
        status: "safe",
        lastUpdated: new Date(),
        tempThreshold: 24,
        humidityThreshold: 60,
        motionThreshold: 5,
        distanceThreshold: 1.5,
        archived: false,
      });
    });
  });

  return sensors;
};

const INITIAL_CONTACTS: Omit<Contact, "id">[] = [
  {
    name: "John Smith",
    role: "Security Chief",
    email: "john.smith@museum.com",
    phone: "+1 (555) 123-4567",
    alertTypes: ["security", "critical"],
    archived: false,
  },
  {
    name: "Maria Garcia",
    role: "Lead Curator",
    email: "maria.garcia@museum.com",
    phone: "+1 (555) 234-5678",
    alertTypes: ["environmental", "security"],
    archived: false,
  },
];

async function seedFirestoreIfEmpty() {
  const sensorsSnap = await getDocs(collection(db, "sensors"));

  if (sensorsSnap.empty) {
    const initialSensors = generateInitialSensors();

    for (const sensor of initialSensors) {
      const ref = doc(collection(db, "sensors"));

      await setDoc(ref, {
        ...sensor,
        lastUpdated: Timestamp.now(),
      });
    }

    console.log("[SEED] Seeded sensors collection");
  }

  const contactsSnap = await getDocs(collection(db, "contacts"));

  if (contactsSnap.empty) {
    for (const contact of INITIAL_CONTACTS) {
      const ref = doc(collection(db, "contacts"));

      await setDoc(ref, contact);
    }

    console.log("[SEED] Seeded contacts collection");
  }

  const settingsSnap = await getDocs(collection(db, "settings"));

  if (settingsSnap.empty) {
    await setDoc(
      doc(db, "settings", "global"),
      DEFAULT_SETTINGS
    );

    console.log("[SEED] Seeded settings document");
  }
}

export const MuseumProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [sensors, setSensors] = useState<SensorData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [settings, setSettings] =
    useState<SystemSettings>(DEFAULT_SETTINGS);
  const [seeded, setSeeded] = useState(false);

  const navigateToAlertsRef =
    useRef<(() => void) | null>(null);

  // ── 1. Seed Firestore on first mount ──────────────────────────
  useEffect(() => {
    seedFirestoreIfEmpty()
      .then(() => setSeeded(true))
      .catch((error) => {
        console.error("[SEED] Error:", error);
        setSeeded(true);
      });
  }, []);

  // ── 2. Real-time Firestore listeners ──────────────────────────
  useEffect(() => {
    if (!seeded) return;

    // --- Sensors ---
    const unsubSensors = onSnapshot(
      collection(db, "sensors"),
      (snap) => {
        const data: SensorData[] = [];

        snap.forEach((d) => {
          const raw = d.data();

          data.push({
            id: d.id,
            name: raw.name || "",
            location: raw.location || "",
            temperature: raw.temperature ?? 20,
            humidity: raw.humidity ?? 45,
            motionDetected: raw.motionDetected ?? false,
            status: raw.status || "safe",
            lastUpdated:
              toDate(raw.lastUpdated) || new Date(),
            tempThreshold: raw.tempThreshold ?? 24,
            humidityThreshold: raw.humidityThreshold ?? 60,
            motionThreshold: raw.motionThreshold ?? 5,
            distanceThreshold: raw.distanceThreshold ?? 1.5,
            archived: raw.archived ?? false,
          });
        });

        setSensors(data);
      }
    );

    // --- Alerts ---
    const alertsQuery = query(
      collection(db, "alerts"),
      orderBy("timestamp", "desc"),
      limit(500)
    );

    const unsubAlerts = onSnapshot(
      alertsQuery,
      (snap) => {
        const data: Alert[] = [];

        snap.forEach((d) => {
          const raw = d.data();

          data.push({
            id: d.id,
            type: raw.type,
            severity: raw.severity,
            message: raw.message,
            sensorId: raw.sensorId,
            timestamp:
              toDate(raw.timestamp) || new Date(),
            acknowledged: raw.acknowledged ?? false,
            acknowledgedBy: raw.acknowledgedBy,
            acknowledgedAt:
              toDate(raw.acknowledgedAt),
            escalated: raw.escalated ?? false,
            escalatedAt:
              toDate(raw.escalatedAt),
          });
        });

        setAlerts(data);
      }
    );

    // --- Logs ---
    const logsQuery = query(
      collection(db, "logs"),
      orderBy("timestamp", "desc"),
      limit(1000)
    );

    const unsubLogs = onSnapshot(
      logsQuery,
      (snap) => {
        const data: LogEntry[] = [];

        snap.forEach((d) => {
          const raw = d.data();

          data.push({
            id: d.id,
            timestamp:
              toDate(raw.timestamp) || new Date(),
            sensorLocation:
              raw.sensorLocation || "",
            temperature: raw.temperature ?? 0,
            humidity: raw.humidity ?? 0,
            motionDetected:
              raw.motionDetected ?? false,
          });
        });

        setLogs(data);
      }
    );

    // --- Contacts ---
    const unsubContacts = onSnapshot(
      collection(db, "contacts"),
      (snap) => {
        const data: Contact[] = [];

        snap.forEach((d) => {
          const raw = d.data();

          data.push({
            id: d.id,
            name: raw.name || "",
            role: raw.role || "",
            email: raw.email || "",
            phone: raw.phone || "",
            alertTypes: raw.alertTypes || [],
            archived: raw.archived ?? false,
          });
        });

        setContacts(data);
      }
    );

    // --- Settings ---
    const unsubSettings = onSnapshot(
      doc(db, "settings", "global"),
      (snap) => {
        if (snap.exists()) {
          setSettings(
            snap.data() as SystemSettings
          );
        }
      }
    );

    return () => {
      unsubSensors();
      unsubAlerts();
      unsubLogs();
      unsubContacts();
      unsubSettings();
    };
  }, [seeded]);

  // ── 3. Automated Alert Dispatch ───────────────────────────────
  const dispatchAlert = (alert: Alert) => {
    const relevantContacts = contacts.filter(
      (c: Contact) =>
        !c.archived &&
        (
          c.alertTypes.includes(alert.type) ||
          (
            alert.severity === "critical" &&
            c.alertTypes.includes("critical")
          )
        )
    );

    if (relevantContacts.length === 0) return;

    if (settings.telegramAlerts) {
      console.log(
        `[TELEGRAM DISPATCH] Sending to ${relevantContacts.length} contacts: ${alert.message}`
      );

      toast.success(
        `Telegram notification sent to ${relevantContacts.length} staff members.`
      );
    }

    if (settings.emailAlerts) {
      console.log(
        `[EMAIL DISPATCH] Sending to ${relevantContacts.length} contacts: ${alert.message}`
      );
    }
  };

  // ── 4. Hardware Trigger ──────────────────────────────────────
  const triggerBuzzer = (sensorName: string) => {
    console.log(
      `[HARDWARE BUZZER] ALARM ACTIVATED AT ${sensorName}`
    );

    toast.error(
      `🔊 LOCAL BUZZER ACTIVATED: Security Breach at ${sensorName}`,
      {
        duration: 10000,
        className: "bg-red-600 text-white font-bold",
      }
    );
  };

  // ── 5. Check sensors and generate alerts ─────────────────────
  const checkSensorsForAlerts = (
    sensorData: SensorData[]
  ): Omit<Alert, "id">[] => {
    const newAlerts: Omit<Alert, "id">[] = [];

    let motionAlertCount = 0;
    const maxMotionAlerts = 2;

    sensorData
      .filter((s) => !s.archived)
      .forEach((sensor) => {
        // Temperature alerts
        if (sensor.temperature > sensor.tempThreshold) {
          newAlerts.push({
            type: "environmental",
            severity:
              sensor.temperature >
              sensor.tempThreshold + 2
                ? "critical"
                : "warning",
            message:
              `High Temperature: ${sensor.temperature}°C ` +
              `exceeds threshold of ${sensor.tempThreshold}°C ` +
              `at ${sensor.name}`,
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
            severity:
              sensor.humidity >
              sensor.humidityThreshold + 10
                ? "critical"
                : "warning",
            message:
              `High Humidity: ${sensor.humidity}% ` +
              `exceeds threshold of ${sensor.humidityThreshold}% ` +
              `at ${sensor.name}`,
            sensorId: sensor.id,
            timestamp: new Date(),
            acknowledged: false,
            escalated: false,
          });
        }

        // Motion alerts
        if (
          sensor.motionDetected &&
          motionAlertCount < maxMotionAlerts
        ) {
          newAlerts.push({
            type: "security",
            severity: "critical",
            message:
              `⚠️ PROXIMITY BREACH: Visitor touched artifact ` +
              `at ${sensor.name}`,
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

  // ── 6. Alert escalation ───────────────────────────────────────
  useEffect(() => {
    if (!seeded) return;

    const escalationInterval = setInterval(
      async () => {
        const now = Date.now();
        const ESCALATION_THRESHOLD_MS =
          15 * 60 * 1000;

        for (const alert of alerts) {
          if (
            !alert.acknowledged &&
            !alert.escalated &&
            now - alert.timestamp.getTime() >
              ESCALATION_THRESHOLD_MS
          ) {
            toast.warning(
              `🚨 ESCALATED: ${alert.message}`,
              { duration: 8000 }
            );

            await updateDoc(
              doc(db, "alerts", alert.id),
              {
                escalated: true,
                escalatedAt: Timestamp.now(),
              }
            );
          }
        }
      },
      30_000
    );

    return () =>
      clearInterval(escalationInterval);
  }, [seeded, alerts]);

  // ── Actions ───────────────────────────────────────────────────

  const updateSettings = async (
    newSettings: SystemSettings
  ) => {
    try {
      await setDoc(
        doc(db, "settings", "global"),
        newSettings
      );

      toast.success(
        "Settings updated successfully"
      );
    } catch (error) {
      console.error(
        "Error updating settings:",
        error
      );

      toast.error(
        "Failed to update settings"
      );
    }
  };

  const updateSensorSettings = async (
    sensorId: string,
    tempThreshold: number,
    humidityThreshold: number,
    motionThreshold: number,
    distanceThreshold: number
  ) => {
    try {
      await updateDoc(
        doc(db, "sensors", sensorId),
        {
          tempThreshold,
          humidityThreshold,
          motionThreshold,
          distanceThreshold,
        }
      );

      toast.success(
        "Sensor settings updated successfully"
      );
    } catch (error) {
      console.error(
        "Error updating sensor settings:",
        error
      );

      toast.error(
        "Failed to update sensor settings"
      );
    }
  };

  const acknowledgeAlert = async (
    alertId: string,
    acknowledgedBy?: string
  ) => {
    try {
      await updateDoc(
        doc(db, "alerts", alertId),
        {
          acknowledged: true,
          acknowledgedBy:
            acknowledgedBy || "System",
          acknowledgedAt: Timestamp.now(),
        }
      );

      toast.success("Alert acknowledged");
    } catch (error) {
      console.error(
        "Error acknowledging alert:",
        error
      );

      toast.error(
        "Failed to acknowledge alert"
      );
    }
  };

  const archiveSensor = async (
    sensorId: string
  ) => {
    try {
      await updateDoc(
        doc(db, "sensors", sensorId),
        { archived: true }
      );

      toast.success(
        "Sensor archived. Historical data and alerts are preserved."
      );
    } catch (error) {
      console.error(
        "Error archiving sensor:",
        error
      );

      toast.error(
        "Failed to archive sensor"
      );
    }
  };

  const addSensor = async (
    name: string,
    location: string
  ) => {
    try {
      await addDoc(
        collection(db, "sensors"),
        {
          name,
          location,
          temperature: 20,
          humidity: 45,
          motionDetected: false,
          status: "safe",
          lastUpdated: Timestamp.now(),
          tempThreshold: 24,
          humidityThreshold: 60,
          motionThreshold:
            settings.motionThreshold,
          distanceThreshold:
            settings.distanceThreshold,
          archived: false,
        }
      );

      toast.success(
        "Sensor added successfully"
      );
    } catch (error) {
      console.error(
        "Error adding sensor:",
        error
      );

      toast.error(
        "Failed to add sensor"
      );
    }
  };

  const setNavigateToAlerts = (
    callback: () => void
  ) => {
    navigateToAlertsRef.current = callback;
  };

  const addContact = async (
    contact: Omit<Contact, "id" | "archived">
  ) => {
    try {
      await addDoc(
        collection(db, "contacts"),
        {
          ...contact,
          archived: false,
        }
      );

      toast.success(
        "Contact added successfully"
      );
    } catch (error) {
      console.error(
        "Error adding contact:",
        error
      );

      toast.error(
        "Failed to add contact"
      );
    }
  };

  const updateContact = async (
    contact: Contact
  ) => {
    try {
      const { id, ...data } = contact;

      await updateDoc(
        doc(db, "contacts", id),
        data
      );

      toast.success(
        "Contact updated successfully"
      );
    } catch (error) {
      console.error(
        "Error updating contact:",
        error
      );

      toast.error(
        "Failed to update contact"
      );
    }
  };

  const archiveContact = async (
    id: string
  ) => {
    try {
      await updateDoc(
        doc(db, "contacts", id),
        { archived: true }
      );

      toast.success(
        "Contact archived. Historical records are preserved."
      );
    } catch (error) {
      console.error(
        "Error archiving contact:",
        error
      );

      toast.error(
        "Failed to archive contact"
      );
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
    throw new Error(
      "useMuseum must be used within a MuseumProvider"
    );
  }

  return context;
};
