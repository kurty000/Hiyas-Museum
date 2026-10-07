import { Bell, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert } from '../types';

interface AlertsPageProps {
  alerts: Alert[];
  onAcknowledgeAlert: (id: string) => void;
}

export function AlertsPage({ alerts, onAcknowledgeAlert }: AlertsPageProps) {
  const { isAdmin } = useAuth();

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      default: return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-yellow-500 bg-yellow-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">Alert Management</h2>
        <p className="text-sm text-gray-600">Monitor and acknowledge system alerts</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-gradient-to-br from-red-50 to-white p-4 rounded-lg border border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{alerts.filter(a => !a.acknowledged).length}</div>
              <div className="text-sm text-gray-600">Active Alerts</div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-white p-4 rounded-lg border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{alerts.filter(a => a.acknowledged).length}</div>
              <div className="text-sm text-gray-600">Acknowledged</div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Active Alerts</h3>
        {alerts.filter(a => !a.acknowledged).map(alert => (
          <div key={alert.id} className={`border-l-4 p-4 rounded-lg shadow-sm ${getSeverityColor(alert.severity)}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1">
                {getSeverityIcon(alert.severity)}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 mb-1">{alert.message}</div>
                  <div className="text-sm text-gray-600 mb-2">
                    <span className="font-medium">{alert.location}</span> • {alert.timestamp}
                  </div>
                  <div className="flex gap-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      alert.type === 'environmental' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {alert.type === 'environmental' ? 'Environmental' : 'Security'}
                    </span>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => onAcknowledgeAlert(alert.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm whitespace-nowrap"
                >
                  Acknowledge
                </button>
              )}
            </div>
          </div>
        ))}

        {alerts.filter(a => !a.acknowledged).length === 0 && (
          <div className="flex items-center gap-3 text-green-600 p-4 bg-green-50 rounded-lg border border-green-200">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">No active alerts</span>
          </div>
        )}

        {alerts.filter(a => a.acknowledged).length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-gray-700 mt-6">Acknowledged Alerts</h3>
            {alerts.filter(a => a.acknowledged).slice(0, 5).map(alert => (
              <div key={alert.id} className="border border-gray-200 p-4 rounded-lg shadow-sm bg-gray-50 opacity-60">
                <div className="flex items-start gap-3">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1">
                    <div className="font-semibold text-gray-900 mb-1">{alert.message}</div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{alert.location}</span> • {alert.timestamp}
                    </div>
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
