import { useMemo, useState } from "react";
import { useMuseum } from "../context/MuseumContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Thermometer, Droplets, Radio, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function Dashboard() {
  const { sensors, alerts, logs } = useMuseum();
  const [selectedSensorId, setSelectedSensorId] = useState<string>("all");

  // Filter data based on selected sensor
  // Filter out archived sensors
  const activeSensors = useMemo(() => sensors.filter(s => !s.archived), [sensors]);

  const filteredSensors = useMemo(() => {
    if (selectedSensorId === "all") return activeSensors;
    return activeSensors.filter((s) => s.id === selectedSensorId);
  }, [activeSensors, selectedSensorId]);

  const filteredLogs = useMemo(() => {
    if (selectedSensorId === "all") return logs;
    const selectedSensor = sensors.find((s) => s.id === selectedSensorId);
    if (!selectedSensor) return logs;
    return logs.filter((log) => log.sensorLocation === selectedSensor.location);
  }, [logs, sensors, selectedSensorId]);

  const filteredAlerts = useMemo(() => {
    if (selectedSensorId === "all") return alerts;
    return alerts.filter((a) => a.sensorId === selectedSensorId);
  }, [alerts, selectedSensorId]);

  // Get selected sensor name for display
  const selectedSensorName = useMemo(() => {
    if (selectedSensorId === "all") return "All Sensors";
    const sensor = sensors.find((s) => s.id === selectedSensorId);
    return sensor ? sensor.name : "All Sensors";
  }, [selectedSensorId, sensors]);

  // Calculate average values from filtered sensors
  const averageTemp = useMemo(() => {
    if (filteredSensors.length === 0) return "0";
    return (
      filteredSensors.reduce((sum, sensor) => sum + sensor.temperature, 0) / filteredSensors.length
    ).toFixed(1);
  }, [filteredSensors]);

  const averageHumidity = useMemo(() => {
    if (filteredSensors.length === 0) return "0";
    return (
      filteredSensors.reduce((sum, sensor) => sum + sensor.humidity, 0) / filteredSensors.length
    ).toFixed(1);
  }, [filteredSensors]);

  const motionDetected = filteredSensors.some((s) => s.motionDetected);

  const criticalSensors = filteredSensors.filter((s) => s.status === "critical").length;
  const warningSensors = filteredSensors.filter((s) => s.status === "warning").length;

  // Status color for overview cards
  const getTempStatus = () => {
    const temp = parseFloat(averageTemp);
    if (temp > 24 || temp < 18) return "critical";
    if (temp > 23 || temp < 19) return "warning";
    return "safe";
  };

  const getHumidityStatus = () => {
    const humidity = parseFloat(averageHumidity);
    if (humidity > 60 || humidity < 40) return "critical";
    if (humidity > 55 || humidity < 45) return "warning";
    return "safe";
  };

  const statusColor = (status: string) => {
    if (status === "safe") return "text-green-600 bg-green-50 border-green-200";
    if (status === "warning") return "text-yellow-600 bg-yellow-50 border-yellow-200";
    if (status === "offline") return "text-gray-500 bg-gray-50 border-gray-300";
    return "text-red-600 bg-red-50 border-red-200";
  };

  // Prepare chart data from recent filtered logs with unique identifiers
  const chartData = useMemo(() => {
    // Get unique logs by creating a map to filter out duplicates
    const logsMap = new Map();
    filteredLogs.forEach((log) => {
      const key = `${log.timestamp.getTime()}-${log.sensorLocation}`;
      if (!logsMap.has(key)) {
        logsMap.set(key, log);
      }
    });

    const uniqueLogs = Array.from(logsMap.values())
      .slice(0, 20)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    return uniqueLogs.map((log, index) => ({
      index: index, // Use simple index as unique identifier
      time: `${log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`,
      temperature: log.temperature,
      humidity: log.humidity,
    }));
  }, [filteredLogs]);

  // Get recent unacknowledged alerts from filtered alerts
  const recentAlerts = filteredAlerts.filter((a) => !a.acknowledged).slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Real-time environmental monitoring and security</p>
        </div>

        {/* Sensor Selector */}
        <div className="flex flex-col gap-2 min-w-[250px]">
          <Label htmlFor="sensor-select" className="text-sm font-medium text-gray-700">
            Select Sensor
          </Label>
          <Select value={selectedSensorId} onValueChange={setSelectedSensorId}>
            <SelectTrigger id="sensor-select" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sensors</SelectItem>
              {activeSensors.map((sensor) => (
                <SelectItem key={sensor.id} value={sensor.id}>
                  {sensor.name}{sensor.status === 'offline' ? ' (Offline)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Temperature Card */}
        <Card className={`border-2 ${statusColor(getTempStatus())}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Temperature</CardTitle>
            <Thermometer className="w-5 h-5" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{averageTemp}°C</div>
            <p className="text-xs mt-1 opacity-80">
              {selectedSensorId === "all" ? "Average across all sensors" : "Current reading"}
            </p>
            <div className="mt-2 text-xs font-medium">
              {getTempStatus() === "safe" && (
                <span className="text-green-600">Normal</span>
              )}
              {getTempStatus() === "warning" && (
                <span className="text-yellow-600">Warning</span>
              )}
              {getTempStatus() === "critical" && (
                <span className="text-red-600">Critical</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Humidity Card */}
        <Card className={`border-2 ${statusColor(getHumidityStatus())}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Humidity</CardTitle>
            <Droplets className="w-5 h-5" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{averageHumidity}%</div>
            <p className="text-xs mt-1 opacity-80">
              {selectedSensorId === "all" ? "Average across all sensors" : "Current reading"}
            </p>
            <div className="mt-2 text-xs font-medium">
              Optimal range: 40–60%
            </div>
          </CardContent>
        </Card>

        {/* Motion Detection Card */}
        <Card
          className={`border-2 ${
            motionDetected
              ? "text-red-600 bg-red-50 border-red-200"
              : "text-green-600 bg-green-50 border-green-200"
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Proximity Detection</CardTitle>
            <Radio className="w-5 h-5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {motionDetected ? "Motion Detected" : "Safe"}
            </div>
            <p className="text-xs mt-1 opacity-80">
              {motionDetected
                ? "Movement detected near artifact"
                : selectedSensorId === "all" ? "All artifacts secure" : "Artifact secure"}
            </p>
          </CardContent>
        </Card>

        {/* Active Alerts Card */}
        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="w-5 h-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{recentAlerts.length}</div>
            <p className="text-xs text-gray-600 mt-1">
              Unacknowledged alerts
            </p>
            <div className="mt-2 text-xs">
              {recentAlerts.filter((a) => a.severity === "critical").length > 0 && (
                <span className="text-red-600 font-medium">
                  {recentAlerts.filter((a) => a.severity === "critical").length} Critical
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Trend */}
        <Card key={`temp-chart-${selectedSensorId}`}>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Temperature Trend – {selectedSensorName}</CardTitle>
              <p className="text-xs text-gray-500">
                Viewing data for: {selectedSensorName}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} key={`temp-line-${selectedSensorId}`}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[15, 30]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    name="Temperature (°C)"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Humidity Trend */}
        <Card key={`humidity-chart-${selectedSensorId}`}>
          <CardHeader>
            <div className="space-y-1">
              <CardTitle>Humidity Trend – {selectedSensorName}</CardTitle>
              <p className="text-xs text-gray-500">
                Viewing data for: {selectedSensorName}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-gray-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} key={`humidity-line-${selectedSensorId}`}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="humidity"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Humidity (%)"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Active Alerts – {selectedSensorName}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentAlerts.map((alert) => {
                const alertSensor = sensors.find((s) => s.id === alert.sensorId);
                const alertType = alert.message.includes("Temperature")
                  ? "Temperature"
                  : alert.message.includes("Humidity")
                  ? "Humidity"
                  : "Proximity";

                return (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      alert.severity === "critical"
                        ? "bg-red-50 border-red-500"
                        : "bg-yellow-50 border-yellow-500"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-xs font-semibold uppercase ${
                              alert.severity === "critical"
                                ? "text-red-700"
                                : "text-orange-600"
                            }`}
                          >
                            {alert.severity === "critical" ? "Critical" : "Warning"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {alertType}
                          </span>
                          {alertSensor && (
                            <span className="text-xs text-gray-500">
                              • {alertSensor.location}
                            </span>
                          )}
                        </div>
                        <p
                          className={`font-medium ${
                            alert.severity === "critical"
                              ? "text-red-900"
                              : "text-yellow-900"
                          }`}
                        >
                          {alert.message}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {alert.timestamp.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}