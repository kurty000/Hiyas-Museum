import { Settings as SettingsIcon, Mail, MessageSquare, Shield } from 'lucide-react';
import { useState } from 'react';

export function SettingsPage() {
  const [tempThreshold, setTempThreshold] = useState(25);
  const [humidityThreshold, setHumidityThreshold] = useState(60);
  const [motionSensitivity, setMotionSensitivity] = useState(5);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [telegramAlerts, setTelegramAlerts] = useState(false);

  const handleSave = () => {
    alert('Settings saved successfully!');
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">System Settings</h2>
        <p className="text-sm text-gray-600">Configure global system parameters and notifications</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Global Thresholds */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Global Thresholds</h3>
          </div>

          <div className="space-y-5">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Default Temperature Threshold: <span className="text-blue-600 font-bold">{tempThreshold}°C</span>
              </label>
              <input
                type="range"
                min="20"
                max="30"
                value={tempThreshold}
                onChange={(e) => setTempThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>20°C</span>
                <span>30°C</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Default Humidity Threshold: <span className="text-blue-600 font-bold">{humidityThreshold}%</span>
              </label>
              <input
                type="range"
                min="40"
                max="80"
                value={humidityThreshold}
                onChange={(e) => setHumidityThreshold(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>40%</span>
                <span>80%</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Default Motion Sensitivity: <span className="text-blue-600 font-bold">{motionSensitivity}</span>
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={motionSensitivity}
                onChange={(e) => setMotionSensitivity(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Low (1)</span>
                <span>High (10)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded">
                  <Mail className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Email Alerts</div>
                  <div className="text-sm text-gray-600">Send alerts via email</div>
                </div>
              </div>
              <button
                onClick={() => setEmailAlerts(!emailAlerts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailAlerts ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailAlerts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded">
                  <MessageSquare className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <div className="font-semibold text-gray-900">Telegram Alerts</div>
                  <div className="text-sm text-gray-600">Send alerts via Telegram</div>
                </div>
              </div>
              <button
                onClick={() => setTelegramAlerts(!telegramAlerts)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  telegramAlerts ? 'bg-green-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    telegramAlerts ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Admin Only</h4>
            </div>
            <p className="text-sm text-gray-600">
              Only administrators can modify system settings. Curators have read-only access to monitor the system.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleSave}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
