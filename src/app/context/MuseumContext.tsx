import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "sonner";

export interface SensorData {
  id: string;
  name: string;
  location: string;
  temperature: number;
  humidity: number;
  motionDetected: boolean;
  status: "safe" | "warning" | "critical" | "offline";
  lastUpdated: Date;
  tempThreshold: number; // Temperature threshold in °C
  humidityThreshold: number; // Humidity threshold in %
  motionThreshold: number; // 1-10 scale
  distanceThreshold: number; // in meters (0.5-3)
  archived: boolean; // Soft-delete flag
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
  distanceThreshold: number; // in meters (0.5-3)
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
  addSensor: (name: string, location: string) => void;
  setNavigateToAlerts: (callback: () => void) => void;
  // Contact management
  addContact: (contact: Omit<Contact, 'id' | 'archived'>) => void;
  updateContact: (contact: Contact) => void;
  archiveContact: (id: string) => void;
}

const MuseumContext = createContext<MuseumContextType | undefined>(undefined);

// Generate mock sensor data
const generateInitialSensors = (): SensorData[] => {
  const galleries = ["Gallery A", "Gallery B", "Gallery C", "Main Hall"];
  const artifacts = ["Artifact 1", "Artifact 2", "Artifact 3"];
  const sensors: SensorData[] = [];

  galleries.forEach((gallery, gIndex) => {
    artifacts.slice(0, gIndex === 0 ? 3 : 2).forEach((artifact, aIndex) => {
      const temp = 20 + Math.random() * 5;
      const humidity = 45 + Math.random() * 20;
      
      sensors.push({
        id: `sensor-${gIndex}-${aIndex}`,
        name: `${gallery} - ${artifact}`,
        location: gallery,
        temperature: parseFloat(temp.toFixed(1)),
        humidity: parseFloat(humidity.toFixed(1)),
        motionDetected: false,
        status: "safe",
        lastUpdated: new Date(),
        tempThreshold: 24, // Default temperature threshold
        humidityThreshold: 60, // Default humidity threshold
        motionThreshold: 5, // Default from global settings
        distanceThreshold: 1.5, // Default from global settings
        archived: false,
      });
    });
  });

  return sensors;
};

// Generate mock logs
const generateInitialLogs = (): LogEntry[] => {
  const logs: LogEntry[] = [];
  const locations = ["Gallery A", "Gallery B", "Gallery C", "Main Hall"];
  
  for (let i = 0; i < 50; i++) {
    const date = new Date();
    date.setHours(date.getHours() - Math.floor(Math.random() * 24));
    date.setMinutes(Math.floor(Math.random() * 60));
    
    logs.push({
      id: `log-${i}`,
      timestamp: date,
      sensorLocation: locations[Math.floor(Math.random() * locations.length)],
      temperature: parseFloat((20 + Math.random() * 5).toFixed(1)),
      humidity: parseFloat((45 + Math.random() * 20).toFixed(1)),
      motionDetected: false,
    });
  }
  
  return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
};

// Initial contacts
const INITIAL_CONTACTS: Contact[] = [
  {
    id: "1",
    name: "John Smith",
    role: "Security Chief",
    email: "john.smith@museum.com",
    phone: "+1 (555) 123-4567",
    alertTypes: ["security", "critical"],
    archived: false,
  },
  {
    id: "2",
    name: "Maria Garcia",
    role: "Lead Curator",
    email: "maria.garcia@museum.com",
    phone: "+1 (555) 234-5678",
    alertTypes: ["environmental", "security"],
    archived: false,
  },
];

const INITIAL_SETTINGS: SystemSettings = {
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

// Helper to revive dates from JSON
const parseDates = (key: string, value: any) => {
  if (['timestamp', 'lastUpdated', 'acknowledgedAt', 'escalatedAt'].includes(key) && typeof value === 'string') {
    return new Date(value);
  }
  return value;
};

export const MuseumProvider = ({ children }: { children: React.ReactNode }) => {
  // Database Logging via LocalStorage
  const [sensors, setSensors] = useState<SensorData[]>(() => {
    const stored = localStorage.getItem('museum_sensors');
    return stored ? JSON.parse(stored, parseDates) : generateInitialSensors();
  });
  const [alerts, setAlerts] = useState<Alert[]>(() => {
    const stored = localStorage.getItem('museum_alerts');
    return stored ? JSON.parse(stored, parseDates) : [];
  });
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const stored = localStorage.getItem('museum_logs');
    return stored ? JSON.parse(stored, parseDates) : generateInitialLogs();
  });
  const [contacts, setContacts] = useState<Contact[]>(() => {
    const stored = localStorage.getItem('museum_contacts');
    return stored ? JSON.parse(stored) : INITIAL_CONTACTS;
  });
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const stored = localStorage.getItem('museum_settings');
    return stored ? JSON.parse(stored) : INITIAL_SETTINGS;
  });

  const navigateToAlertsRef = React.useRef<(() => void) | null>(null);

  // Persist state to localStorage on changes
  useEffect(() => { localStorage.setItem('museum_sensors', JSON.stringify(sensors)); }, [sensors]);
  useEffect(() => { localStorage.setItem('museum_alerts', JSON.stringify(alerts)); }, [alerts]);
  useEffect(() => { localStorage.setItem('museum_logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('museum_contacts', JSON.stringify(contacts)); }, [contacts]);
  useEffect(() => { localStorage.setItem('museum_settings', JSON.stringify(settings)); }, [settings]);

  // Automated Dispatch Simulation
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

  // Hardware Trigger Simulation
  const triggerBuzzer = (sensorName: string) => {
    console.log(`[HARDWARE BUZZER] ALARM ACTIVATED AT ${sensorName}`);
    toast.error(`🔊 LOCAL BUZZER ACTIVATED: Security Breach at ${sensorName}`, {
      duration: 10000,
      className: 'bg-red-600 text-white font-bold',
    });
  };

  // Check sensors and generate alerts
  const checkSensorsForAlerts = (sensorData: SensorData[]) => {
    const newAlerts: Alert[] = [];
    
    let motionAlertCount = 0;
    const maxMotionAlerts = 2; // Limit motion alerts per cycle

    sensorData.filter(s => !s.archived).forEach((sensor) => {
      // Temperature alerts - Using per-sensor threshold
      if (sensor.temperature > sensor.tempThreshold) {
        newAlerts.push({
          id: `alert-${Date.now()}-${sensor.id}-temp-high`,
          type: "environmental",
          severity: sensor.temperature > sensor.tempThreshold + 2 ? "critical" : "warning",
          message: `High Temperature: ${sensor.temperature}°C exceeds threshold of ${sensor.tempThreshold}°C at ${sensor.name}`,
          sensorId: sensor.id,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
        });
      }

      // Humidity alerts - Using per-sensor threshold
      if (sensor.humidity > sensor.humidityThreshold) {
        newAlerts.push({
          id: `alert-${Date.now()}-${sensor.id}-hum-high`,
          type: "environmental",
          severity: sensor.humidity > sensor.humidityThreshold + 10 ? "critical" : "warning",
          message: `High Humidity: ${sensor.humidity}% exceeds threshold of ${sensor.humidityThreshold}% at ${sensor.name}`,
          sensorId: sensor.id,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
        });
      }

      // Motion alerts - Proximity breach
      if (sensor.motionDetected && motionAlertCount < maxMotionAlerts) {
        newAlerts.push({
          id: `alert-${Date.now()}-${sensor.id}-motion`,
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
    });

    return newAlerts;
  };

  // Alert escalation check — escalate unacknowledged alerts after 15 minutes
  useEffect(() => {
    const escalationInterval = setInterval(() => {
      setAlerts((prev: Alert[]) => {
        const now = Date.now();
        const ESCALATION_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
        let hasChanges = false;

        const updated = prev.map((alert: Alert) => {
          if (
            !alert.acknowledged &&
            !alert.escalated &&
            now - alert.timestamp.getTime() > ESCALATION_THRESHOLD_MS
          ) {
            hasChanges = true;
            toast.warning(
              `🚨 ESCALATED: ${alert.message}`,
              { duration: 8000 }
            );
            return { ...alert, escalated: true, escalatedAt: new Date() };
          }
          return alert;
        });

        return hasChanges ? updated : prev;
      });
    }, 30_000); // Check every 30 seconds

    return () => clearInterval(escalationInterval);
  }, []);

  // Simulate real-time sensor updates based on reporting interval
  useEffect(() => {
    const updateIntervalMs = settings.reportingIntervalSeconds * 1000;

    const interval = setInterval(() => {
      setSensors((prevSensors: SensorData[]) => {
        const updatedSensors = prevSensors.map((sensor: SensorData) => {
          if (sensor.archived) return sensor;

          // Small random changes to simulate real sensors
          const tempChange = (Math.random() - 0.5) * 0.5;
          const humChange = (Math.random() - 0.5) * 2;
          const newTemp = parseFloat((sensor.temperature + tempChange).toFixed(1));
          const newHum = parseFloat(Math.max(0, Math.min(100, sensor.humidity + humChange)).toFixed(1));
          
          // Motion detection - very rare events (only 1% chance per update)
          const motionDetected = Math.random() > 0.99;

          let status: "safe" | "warning" | "critical" | "offline" = "safe";
          if (motionDetected) {
            status = "critical";
          } else if (newTemp > sensor.tempThreshold || newHum > sensor.humidityThreshold) {
            status = "warning";
          }

          // Random offline simulation
          if (Math.random() > 0.995) {
            status = "offline";
          }

          return {
            ...sensor,
            temperature: status === 'offline' ? sensor.temperature : newTemp,
            humidity: status === 'offline' ? sensor.humidity : newHum,
            motionDetected,
            status,
            lastUpdated: new Date(),
          };
        });

        // Check for new alerts
        const newAlerts = checkSensorsForAlerts(updatedSensors);
        if (newAlerts.length > 0) {
          setAlerts((prev: Alert[]) => {
            // Only add unique alerts (not duplicates from recent checks)
            const recentAlertKeys = new Set(
              prev
                .filter((a: Alert) => Date.now() - a.timestamp.getTime() < 60000)
                .map((a: Alert) => `${a.sensorId}-${a.type}`)
            );
            
            const uniqueNewAlerts = newAlerts.filter((alert: Alert) => {
              const key = `${alert.sensorId}-${alert.type}`;
              return !recentAlertKeys.has(key);
            });

            // Side effects for new alerts
            uniqueNewAlerts.forEach((alert) => {
              // Dispatch (Telegram/Email)
              dispatchAlert(alert);

              // Hardware triggers for critical proximity
              if (alert.type === 'security' && alert.severity === 'critical') {
                const sensor = updatedSensors.find((s: SensorData) => s.id === alert.sensorId);
                if (sensor) triggerBuzzer(sensor.name);
              }

              // UI Toast for critical alerts
              if (alert.severity === "critical") {
                toast.error(alert.message, {
                  duration: 5000,
                  action: {
                    label: "View Alert",
                    onClick: () => {
                      if (navigateToAlertsRef.current) {
                        navigateToAlertsRef.current();
                      } else {
                        window.location.href = "/dashboard/alerts";
                      }
                    },
                  },
                });
              }
            });

            // Add to database logs ONLY when there are alerts
            if (uniqueNewAlerts.length > 0) {
              setLogs((prevLogs: LogEntry[]) => {
                const newLogs = uniqueNewAlerts.map((alert, index) => {
                  const sensor = updatedSensors.find((s: SensorData) => s.id === alert.sensorId);
                  return {
                    id: `log-${Date.now()}-${alert.id}-${index}`,
                    timestamp: new Date(),
                    sensorLocation: sensor?.location || 'Unknown',
                    temperature: sensor?.temperature || 0,
                    humidity: sensor?.humidity || 0,
                    motionDetected: sensor?.motionDetected || false,
                  };
                });
                return [...newLogs, ...prevLogs].slice(0, 1000); // Keep last 1000 logs
              });
            }

            return [...uniqueNewAlerts, ...prev].slice(0, 500); // Keep last 500 alerts
          });
        }

        return updatedSensors;
      });
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [settings, contacts]);

  const updateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    toast.success("Settings updated successfully");
  };

  const updateSensorSettings = (sensorId: string, tempThreshold: number, humidityThreshold: number, motionThreshold: number, distanceThreshold: number) => {
    setSensors((prev: SensorData[]) =>
      prev.map((sensor: SensorData) =>
        sensor.id === sensorId
          ? { ...sensor, tempThreshold, humidityThreshold, motionThreshold, distanceThreshold }
          : sensor
      )
    );
    toast.success("Sensor settings updated successfully");
  };

  const acknowledgeAlert = (alertId: string, acknowledgedBy?: string) => {
    setAlerts((prev: Alert[]) =>
      prev.map((alert: Alert) =>
        alert.id === alertId
          ? { ...alert, acknowledged: true, acknowledgedBy: acknowledgedBy || 'System', acknowledgedAt: new Date() }
          : alert
      )
    );
    toast.success("Alert acknowledged");
  };

  const archiveSensor = (sensorId: string) => {
    setSensors((prev: SensorData[]) =>
      prev.map((sensor: SensorData) =>
        sensor.id === sensorId ? { ...sensor, archived: true } : sensor
      )
    );
    toast.success("Sensor archived. Historical data and alerts are preserved.");
  };

  const addSensor = (name: string, location: string) => {
    const newSensor: SensorData = {
      id: `sensor-${Date.now()}`,
      name,
      location,
      temperature: 20,
      humidity: 45,
      motionDetected: false,
      status: "safe",
      lastUpdated: new Date(),
      tempThreshold: 24,
      humidityThreshold: 60,
      motionThreshold: settings.motionThreshold,
      distanceThreshold: settings.distanceThreshold,
      archived: false,
    };
    setSensors((prev: SensorData[]) => [...prev, newSensor]);
    toast.success("Sensor added successfully");
  };

  const setNavigateToAlerts = (callback: () => void) => {
    navigateToAlertsRef.current = callback;
  };

  const addContact = (contact: Omit<Contact, 'id' | 'archived'>) => {
    const newContact: Contact = {
      ...contact,
      id: Date.now().toString(),
      archived: false,
    };
    setContacts((prev: Contact[]) => [...prev, newContact]);
    toast.success("Contact added successfully");
  };

  const updateContact = (contact: Contact) => {
    setContacts((prev: Contact[]) =>
      prev.map((c: Contact) => (c.id === contact.id ? contact : c))
    );
    toast.success("Contact updated successfully");
  };

  const archiveContact = (id: string) => {
    setContacts((prev: Contact[]) =>
      prev.map((c: Contact) => (c.id === id ? { ...c, archived: true } : c))
    );
    toast.success("Contact archived. Historical records are preserved.");
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
    throw new Error("useMuseum must be used within a MuseumProvider");
  }
  return context;
};