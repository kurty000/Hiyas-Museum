export interface SensorData {
  id: string;
  name: string;
  location: string;
  temperature: number;
  humidity: number;
  motion: boolean;
  status: 'safe' | 'warning' | 'critical';
  settings: {
    tempThreshold: number;
    humidityThreshold: number;
    motionSensitivity: number;
  };
}

export interface Alert {
  id: string;
  type: 'environmental' | 'security';
  category: 'temperature' | 'humidity' | 'motion';
  message: string;
  location: string;
  timestamp: string;
  acknowledged: boolean;
  severity: 'info' | 'warning' | 'critical';
}

export interface LogEntry {
  id: string;
  timestamp: string;
  sensorId: string;
  location: string;
  temperature: number;
  humidity: number;
  motion: boolean;
  event: string;
  type: 'normal' | 'warning' | 'critical';
}
