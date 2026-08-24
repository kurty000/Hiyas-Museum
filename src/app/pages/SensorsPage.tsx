import { Thermometer, Droplets, Activity, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SensorData } from '../types';
import { useState } from 'react';

interface SensorsPageProps {
  sensors: SensorData[];
  onUpdateSensor: (id: string, settings: Partial<SensorData['settings']>) => void;
}

export function SensorsPage({ sensors, onUpdateSensor }: SensorsPageProps) {
  const { isAdmin } = useAuth();
  const [editingSensor, setEditingSensor] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<{ [key: string]: SensorData['settings'] }>({});

  const handleEditSensor = (sensorId: string) => {
    const sensor = sensors.find(s => s.id === sensorId);
    if (sensor) {
      setTempSettings({ ...tempSettings, [sensorId]: { ...sensor.settings } });
      setEditingSensor(sensorId);
    }
  };

  const handleSaveSensor = (sensorId: string) => {
    if (tempSettings[sensorId]) {
      onUpdateSensor(sensorId, tempSettings[sensorId]);
      setEditingSensor(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Sensor Monitoring</h2>
        <p className="text-sm text-gray-600">Real-time sensor data and configuration</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {sensors.map(sensor => {
          const isEditing = editingSensor === sensor.id;
          const settings = isEditing ? tempSettings[sensor.id] : sensor.settings;

          return (
            <div
              key={sensor.id}
              className={`border rounded-lg p-4 transition-all ${
                sensor.motion
                  ? 'border-red-300 bg-gradient-to-br from-red-50 to-white'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="font-bold text-base text-gray-900">{sensor.name}</div>
                  <div className="text-sm text-gray-500">{sensor.location}</div>
                </div>
                <div className="flex items-center gap-2">
                  {sensor.motion && <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>}
                  {isAdmin && !isEditing && (
                    <button
                      onClick={() => handleEditSensor(sensor.id)}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                      title="Edit settings"
                    >
                      <SettingsIcon className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 mb-3">
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-blue-600" />
                    Temperature
                  </span>
                  <span className="font-bold text-gray-900">{sensor.temperature}°C</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-cyan-50 rounded">
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-cyan-600" />
                    Humidity
                  </span>
                  <span className="font-bold text-gray-900">{sensor.humidity}%</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700 flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Motion
                  </span>
                  <span className={`font-bold ${sensor.motion ? 'text-red-600' : 'text-green-600'}`}>
                    {sensor.motion ? 'Detected' : 'Safe'}
                  </span>
                </div>
              </div>

              {isEditing && (
                <div className="pt-3 border-t border-gray-200 space-y-3">
                  <div>
                    <label className="text-sm text-gray-700 block mb-1.5 font-medium">
                      Temp Threshold: <span className="text-blue-600">{settings.tempThreshold}°C</span>
                    </label>
                    <input
                      type="range"
                      min="20"
                      max="30"
                      value={settings.tempThreshold}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        [sensor.id]: { ...settings, tempThreshold: Number(e.target.value) }
                      })}
                      className="w-full h-2 bg-gray-200 rounded accent-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700 block mb-1.5 font-medium">
                      Humidity Threshold: <span className="text-blue-600">{settings.humidityThreshold}%</span>
                    </label>
                    <input
                      type="range"
                      min="40"
                      max="80"
                      value={settings.humidityThreshold}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        [sensor.id]: { ...settings, humidityThreshold: Number(e.target.value) }
                      })}
                      className="w-full h-2 bg-gray-200 rounded accent-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-700 block mb-1.5 font-medium">
                      Motion Sensitivity: <span className="text-blue-600">{settings.motionSensitivity}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={settings.motionSensitivity}
                      onChange={(e) => setTempSettings({
                        ...tempSettings,
                        [sensor.id]: { ...settings, motionSensitivity: Number(e.target.value) }
                      })}
                      className="w-full h-2 bg-gray-200 rounded accent-blue-600"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSaveSensor(sensor.id)}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 text-sm"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingSensor(null)}
                      className="flex-1 px-3 py-2 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {!isEditing && (
                <div className="flex items-center gap-2 pt-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(sensor.status)}`}></div>
                  <span className="text-sm font-semibold text-gray-700 capitalize">{sensor.status}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
