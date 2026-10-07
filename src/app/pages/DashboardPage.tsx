import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Thermometer, Droplets, Activity, AlertTriangle, CheckCircle2, Bell, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { SensorData, Alert } from '../types';
import { useState } from 'react';

interface DashboardProps {
  sensors: SensorData[];
  onUpdateSensor: (id: string, settings: Partial<SensorData['settings']>) => void;
  alerts: Alert[];
  onAcknowledgeAlert: (id: string) => void;
}

export function DashboardPage({ sensors, onUpdateSensor, alerts, onAcknowledgeAlert }: DashboardProps) {
  const { isAdmin } = useAuth();
  const [editingSensor, setEditingSensor] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<{ [key: string]: SensorData['settings'] }>({});

  const chartData = [
    { time: '10:00', temperature: 21, humidity: 50 },
    { time: '11:00', temperature: 21.5, humidity: 52 },
    { time: '12:00', temperature: 22, humidity: 53 },
    { time: '13:00', temperature: 22.5, humidity: 55 },
    { time: '14:00', temperature: 22.8, humidity: 57 },
    { time: '15:00', temperature: 22.5, humidity: 55 },
  ];

  const avgTemp = (sensors.reduce((sum, s) => sum + s.temperature, 0) / sensors.length).toFixed(1);
  const avgHumidity = (sensors.reduce((sum, s) => sum + s.humidity, 0) / sensors.length).toFixed(1);
  const motionDetected = sensors.some(s => s.motion);

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

  const handleCancelEdit = () => {
    setEditingSensor(null);
    setTempSettings({});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <div className="space-y-3">
      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gradient-to-br from-white to-blue-50 rounded-lg shadow-md p-3 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-blue-100 rounded">
                <Thermometer className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Avg Temperature</span>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{avgTemp}°C</div>
          <div className="text-xs font-semibold text-green-600 mt-1">Normal</div>
        </div>

        <div className="bg-gradient-to-br from-white to-cyan-50 rounded-lg shadow-md p-3 border border-cyan-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-cyan-100 rounded">
                <Droplets className="w-4 h-4 text-cyan-600" />
              </div>
              <span className="text-xs font-semibold text-gray-700">Avg Humidity</span>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          </div>
          <div className="text-2xl font-bold text-gray-900">{avgHumidity}%</div>
          <div className="text-xs font-semibold text-green-600 mt-1">Normal</div>
        </div>

        <div className={`rounded-lg shadow-md p-3 border ${motionDetected ? 'bg-gradient-to-br from-white to-red-50 border-red-200' : 'bg-gradient-to-br from-white to-green-50 border-green-100'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded ${motionDetected ? 'bg-red-100' : 'bg-green-100'}`}>
                <Activity className={`w-4 h-4 ${motionDetected ? 'text-red-600' : 'text-green-600'}`} />
              </div>
              <span className="text-xs font-semibold text-gray-700">Motion Status</span>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${motionDetected ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></div>
          </div>
          <div className="text-xl font-bold text-gray-900">{motionDetected ? 'Detected' : 'Safe'}</div>
          <div className={`text-xs font-semibold mt-1 ${motionDetected ? 'text-red-600' : 'text-green-600'}`}>
            {motionDetected ? 'Alert' : 'Normal'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Left Section */}
        <div className="col-span-8 space-y-3">
          {/* Graphs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Thermometer className="w-3 h-3 text-blue-600" />
                Temperature Trend
              </h3>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={chartData}>
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                  <YAxis domain={[18, 26]} tick={{ fontSize: 9 }} stroke="#9ca3af" width={30} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="temperature" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
              <h3 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                <Droplets className="w-3 h-3 text-cyan-600" />
                Humidity Trend
              </h3>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={chartData}>
                  <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#9ca3af" />
                  <YAxis domain={[45, 70]} tick={{ fontSize: 9 }} stroke="#9ca3af" width={30} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="humidity" stroke="#0891b2" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Sensor Grid */}
          <div className="bg-white rounded-lg shadow-md p-3 border border-gray-200">
            <h3 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <div className="w-1 h-4 bg-blue-600 rounded"></div>
              Sensor Monitoring {isAdmin && <span className="text-xs text-gray-500 font-normal ml-1">(Click settings to edit)</span>}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {sensors.map(sensor => {
                const isEditing = editingSensor === sensor.id;
                const settings = isEditing ? tempSettings[sensor.id] : sensor.settings;

                return (
                  <div
                    key={sensor.id}
                    className={`border rounded-lg p-3 transition-all ${
                      sensor.motion
                        ? 'border-red-300 bg-gradient-to-br from-red-50 to-white'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-sm text-gray-900">{sensor.name}</div>
                        <div className="text-xs text-gray-500">{sensor.location}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {sensor.motion && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                        {isAdmin && !isEditing && (
                          <button
                            onClick={() => handleEditSensor(sensor.id)}
                            className="p-1 hover:bg-gray-100 rounded transition-colors"
                            title="Edit settings"
                          >
                            <SettingsIcon className="w-3.5 h-3.5 text-gray-600" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-blue-600" />
                          Temp
                        </span>
                        <span className="font-semibold text-gray-900">{sensor.temperature}°C</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-cyan-600" />
                          Humidity
                        </span>
                        <span className="font-semibold text-gray-900">{sensor.humidity}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          Motion
                        </span>
                        <span className={`font-semibold ${sensor.motion ? 'text-red-600' : 'text-green-600'}`}>
                          {sensor.motion ? 'Detected' : 'Safe'}
                        </span>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="pt-2 border-t border-gray-200 space-y-2">
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">
                            Temp Threshold: <span className="text-blue-600 font-semibold">{settings.tempThreshold}°C</span>
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
                            className="w-full h-1 bg-gray-200 rounded accent-blue-600"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">
                            Humidity Threshold: <span className="text-blue-600 font-semibold">{settings.humidityThreshold}%</span>
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
                            className="w-full h-1 bg-gray-200 rounded accent-blue-600"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-600 block mb-1">
                            Motion Sensitivity: <span className="text-blue-600 font-semibold">{settings.motionSensitivity}</span>
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
                            className="w-full h-1 bg-gray-200 rounded accent-blue-600"
                          />
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleSaveSensor(sensor.id)}
                            className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="flex-1 px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1 mt-2">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(sensor.status)}`}></div>
                        <span className="text-xs font-medium text-gray-600 capitalize">{sensor.status}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Section - Alerts */}
        <div className="col-span-4">
          <div className="bg-gradient-to-br from-white to-red-50 rounded-lg shadow-md p-3 border border-red-200">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1 bg-red-100 rounded">
                <Bell className="w-3.5 h-3.5 text-red-600" />
              </div>
              <h3 className="text-xs font-semibold text-gray-800">Active Alerts</h3>
              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-red-500 text-white rounded-full text-xs font-bold">
                  {alerts.filter(a => !a.acknowledged).length}
                </span>
              )}
            </div>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {alerts.filter(a => !a.acknowledged).slice(0, 5).map(alert => (
                <div key={alert.id} className={`border-l-4 bg-white p-2 rounded shadow-sm ${
                  alert.severity === 'critical' ? 'border-red-500' :
                  alert.severity === 'warning' ? 'border-yellow-500' :
                  'border-blue-500'
                }`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-gray-900">{alert.message}</div>
                      <div className="text-xs text-gray-600">{alert.location}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{alert.timestamp}</div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => onAcknowledgeAlert(alert.id)}
                        className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap font-medium"
                      >
                        Ack
                      </button>
                    )}
                  </div>
                  <div className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                    alert.type === 'environmental' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {alert.type === 'environmental' ? 'Environmental' : 'Security'}
                  </div>
                </div>
              ))}
              {alerts.filter(a => !a.acknowledged).length === 0 && (
                <div className="flex items-center gap-2 text-green-600 text-xs p-3 bg-green-50 rounded border border-green-200">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="font-medium">No active alerts</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
