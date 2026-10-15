import { useState } from "react";
import { useMuseum } from "../context/MuseumContext";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { Slider } from "../components/ui/slider";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import { Thermometer, Droplets, Radio, Settings, Activity, Target, Plus, Trash2, Cpu } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import type { DetectedDevice } from "../context/MuseumContext";

export default function Sensors() {
  const {
    sensors,
    detectedDevices,
    deleteSensor,
    updateSensorSettings,
    registerDetectedSensor,
    settings,
  } = useMuseum();
  const { isAdmin } = useAuth();
  const [editingSensor, setEditingSensor] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<{
    tempThreshold: number;
    humidityThreshold: number;
    motionThreshold: number;
    distanceThreshold: number;
  } | null>(null);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [confirmRegisterOpen, setConfirmRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(null);
  const [newSensorName, setNewSensorName] = useState("");
  const [newSensorLocation, setNewSensorLocation] = useState("");
  const [newTempThreshold, setNewTempThreshold] = useState(24);
  const [newHumidityThreshold, setNewHumidityThreshold] = useState(60);
  const [newMotionThreshold, setNewMotionThreshold] = useState(5);
  const [newDistanceThreshold, setNewDistanceThreshold] = useState(150);
  const [confirmSaveDialogOpen, setConfirmSaveDialogOpen] = useState(false);
  const [savingSensorId, setSavingSensorId] = useState<string | null>(null);

  // Only show non-archived registered sensors
  const activeSensors = sensors.filter((s) => !s.archived);

  const handleEditSensor = (sensorId: string, tempThreshold: number, humidityThreshold: number, motionThreshold: number, distanceThreshold: number) => {
    setEditingSensor(sensorId);
    setTempSettings({ tempThreshold, humidityThreshold, motionThreshold, distanceThreshold });
  };

  // Open confirmation modal before saving threshold changes
  const handlePrepareSaveSensor = (sensorId: string) => {
    setSavingSensorId(sensorId);
    setConfirmSaveDialogOpen(true);
  };

  const handleConfirmSaveSensor = () => {
    if (tempSettings && savingSensorId) {
      updateSensorSettings(savingSensorId, tempSettings.tempThreshold, tempSettings.humidityThreshold, tempSettings.motionThreshold, tempSettings.distanceThreshold);
    }
    setEditingSensor(null);
    setTempSettings(null);
    setSavingSensorId(null);
    setConfirmSaveDialogOpen(false);
  };

  const handleCancelEdit = () => {
    setEditingSensor(null);
    setTempSettings(null);
  };

  const getStatusBadge = (status: string) => {
    if (status === "safe") {
      return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Safe</Badge>;
    }
    if (status === "warning") {
      return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Warning</Badge>;
    }
    if (status === "offline") {
      return <Badge className="bg-gray-200 text-gray-600 hover:bg-gray-200">Offline</Badge>;
    }
    return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Critical</Badge>;
  };

  const getCardBorderColor = (status: string) => {
    if (status === "safe") return "border-green-200";
    if (status === "warning") return "border-yellow-200";
    if (status === "offline") return "border-gray-300";
    return "border-red-200";
  };

  const openRegisterDialog = (device: DetectedDevice) => {
    setSelectedDevice(device);
    setNewSensorName(device.suggestedName);
    setNewSensorLocation(device.suggestedLocation);
    setNewTempThreshold(24);
    setNewHumidityThreshold(60);
    setNewMotionThreshold(settings.motionThreshold ?? 5);
    setNewDistanceThreshold(settings.distanceThreshold ?? 150);
    setRegisterDialogOpen(true);
  };

  const handlePrepareRegister = () => {
    if (!selectedDevice || !newSensorName.trim() || !newSensorLocation.trim()) return;
    setRegisterDialogOpen(false);
    setConfirmRegisterOpen(true);
  };

  const handleConfirmRegister = async () => {
    if (!selectedDevice) return;
    setRegistering(true);
    try {
      await registerDetectedSensor({
        deviceId: selectedDevice.deviceId,
        name: newSensorName.trim(),
        location: newSensorLocation.trim(),
        tempThreshold: newTempThreshold,
        humidityThreshold: newHumidityThreshold,
        motionThreshold: newMotionThreshold,
        distanceThreshold: newDistanceThreshold,
      });
      setConfirmRegisterOpen(false);
      setSelectedDevice(null);
    } finally {
      setRegistering(false);
    }
  };

  const handleCancelRegister = () => {
    setConfirmRegisterOpen(false);
    setRegisterDialogOpen(false);
    setSelectedDevice(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sensor Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Detected hardware must be registered before monitoring. Registered sensors go Offline
            after 60s without data.
          </p>
        </div>

        {/* Save Threshold Confirmation Dialog */}
        <AlertDialog open={confirmSaveDialogOpen} onOpenChange={setConfirmSaveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Threshold Changes</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to update the threshold settings for this sensor? This will immediately affect alert generation.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setConfirmSaveDialogOpen(false); setSavingSensorId(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmSaveSensor}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Confirm Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Detected Devices — not yet registered */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Detected Devices</h2>
            <p className="text-sm text-gray-600 mt-1">
              Hardware reporting on the network. Add a device as a sensor to start monitoring it.
            </p>
          </div>
          {detectedDevices.length > 0 && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              {detectedDevices.length} detected
            </Badge>
          )}
        </div>

        {detectedDevices.length === 0 ? (
          <Card className="border border-dashed border-gray-300 bg-gray-50/60">
            <CardContent className="py-10 text-center text-gray-500">
              <Cpu className="w-8 h-8 mx-auto mb-3 text-gray-400" />
              <p className="font-medium text-gray-700">No new devices detected</p>
              <p className="text-sm mt-1">
                When an ESP32 writes to Realtime Database <code className="bg-white px-1 rounded border">liveSensors/…</code>, it will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {detectedDevices.map((device) => (
              <Card key={device.deviceId} className="border-2 border-amber-200 bg-amber-50/40">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{device.suggestedName}</CardTitle>
                      <p className="text-sm text-gray-600 mt-1">{device.suggestedLocation}</p>
                    </div>
                    <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200">Detected</Badge>
                  </div>
                  <p className="text-xs font-mono text-gray-500 mt-2">{device.deviceId}</p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Thermometer className="w-3.5 h-3.5" />
                      {device.temperature.toFixed(1)}°C
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Droplets className="w-3.5 h-3.5" />
                      {device.humidity.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Radio className="w-3.5 h-3.5" />
                      {device.motionDetected ? "Motion" : "Clear"}
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-700">
                      <Target className="w-3.5 h-3.5" />
                      {device.distanceCm != null ? `${device.distanceCm.toFixed(1)} cm` : "—"}
                    </div>
                  </div>
                  {isAdmin && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => openRegisterDialog(device)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Register Device
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Register detected device dialog */}
      <Dialog
        open={registerDialogOpen}
        onOpenChange={(open) => {
          setRegisterDialogOpen(open);
          if (!open) setSelectedDevice(null);
        }}
      >
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Sensor</DialogTitle>
            <DialogDescription>
              Configure monitoring settings for{" "}
              <span className="font-mono text-xs">{selectedDevice?.deviceId}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sensor-name">Sensor Name</Label>
              <Input
                id="sensor-name"
                value={newSensorName}
                onChange={(e) => setNewSensorName(e.target.value)}
                placeholder="e.g., Gallery A - Artifact 1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sensor-location">Location</Label>
              <Input
                id="sensor-location"
                value={newSensorLocation}
                onChange={(e) => setNewSensorLocation(e.target.value)}
                placeholder="e.g., Gallery A"
              />
            </div>
            <div className="rounded-md bg-gray-50 border px-3 py-2 text-sm">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Device type</p>
              <p className="font-medium text-gray-800">ESP32 environmental / proximity sensor</p>
            </div>
            <div className="space-y-2">
              <Label>Temperature threshold (°C): {newTempThreshold}</Label>
              <Slider
                min={10}
                max={40}
                step={0.5}
                value={[newTempThreshold]}
                onValueChange={([v]) => setNewTempThreshold(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Humidity threshold (%): {newHumidityThreshold}</Label>
              <Slider
                min={20}
                max={90}
                step={1}
                value={[newHumidityThreshold]}
                onValueChange={([v]) => setNewHumidityThreshold(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Motion sensitivity (1–10): {newMotionThreshold}</Label>
              <Slider
                min={1}
                max={10}
                step={1}
                value={[newMotionThreshold]}
                onValueChange={([v]) => setNewMotionThreshold(v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Distance limit (cm): {newDistanceThreshold}</Label>
              <Slider
                min={5}
                max={500}
                step={1}
                value={[newDistanceThreshold]}
                onValueChange={([v]) => setNewDistanceThreshold(v)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelRegister}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={!newSensorName.trim() || !newSensorLocation.trim()}
              onClick={handlePrepareRegister}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRegisterOpen} onOpenChange={setConfirmRegisterOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Register Sensor</AlertDialogTitle>
            <AlertDialogDescription>
              Save &quot;{newSensorName}&quot; at &quot;{newSensorLocation}&quot; linked to{" "}
              <span className="font-mono">{selectedDevice?.deviceId}</span>? It will appear under
              registered sensors for monitoring and alerts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelRegister} disabled={registering}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              disabled={registering}
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmRegister();
              }}
            >
              {registering ? "Saving..." : "Save Sensor"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Registered Sensors */}
      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Registered Sensors</h2>
          <p className="text-sm text-gray-600 mt-1">
            Official sensors available for monitoring and alerts
          </p>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {activeSensors.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3 border border-dashed border-gray-300">
            <CardContent className="py-10 text-center text-gray-500">
              <p className="font-medium text-gray-700">No registered sensors yet</p>
              <p className="text-sm mt-1">
                Register a detected device above to start monitoring.
              </p>
            </CardContent>
          </Card>
        ) : null}
        {activeSensors.map((sensor) => {
          const isEditing = editingSensor === sensor.id;
          const currentTemp = isEditing ? tempSettings!.tempThreshold : sensor.tempThreshold;
          const currentHumidity = isEditing ? tempSettings!.humidityThreshold : sensor.humidityThreshold;
          const currentMotion = isEditing ? tempSettings!.motionThreshold : sensor.motionThreshold;
          const currentDistance = isEditing ? tempSettings!.distanceThreshold : sensor.distanceThreshold;

          return (
            <Card
              key={sensor.id}
              className={`border-2 ${getCardBorderColor(sensor.status)} hover:shadow-lg transition-shadow`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{sensor.name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">{sensor.location}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(sensor.status)}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-1" />
                          Delete Sensor
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Sensor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Permanently delete &quot;{sensor.name}&quot;? If the device keeps reporting, it will appear under Detected Devices so you can register it again.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSensor(sensor.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Temperature */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-100 p-2 rounded">
                      <Thermometer className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Temperature</p>
                      <p className="text-lg font-bold text-gray-900">
                        {sensor.temperature}°C
                      </p>
                    </div>
                  </div>
                </div>

                {/* Humidity */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded">
                      <Droplets className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Humidity</p>
                      <p className="text-lg font-bold text-gray-900">
                        {sensor.humidity}%
                      </p>
                    </div>
                  </div>
                </div>

                {/* Motion / Distance — cm only */}
                {(() => {
                  const limitCm = sensor.distanceThreshold;
                  const distCm = sensor.distanceCm;
                  // Breach when object is at or closer than the set cm limit
                  const tooClose = distCm != null && distCm <= limitCm;
                  const breach = sensor.motionDetected || tooClose;
                  return (
                    <div
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        breach ? "bg-red-50" : "bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2 rounded ${
                            breach ? "bg-red-100" : "bg-gray-100"
                          }`}
                        >
                          <Radio
                            className={`w-5 h-5 ${
                              breach ? "text-red-600" : "text-gray-600"
                            }`}
                          />
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Distance Status</p>
                          <p
                            className={`text-lg font-bold ${
                              breach ? "text-red-600" : "text-gray-900"
                            }`}
                          >
                            {breach ? "Breach!" : "Safe"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {distCm != null
                              ? `${distCm.toFixed(1)} cm / limit ${limitCm.toFixed(0)} cm`
                              : `No reading / limit ${limitCm.toFixed(0)} cm`}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {isAdmin && (
                  <>
                    <Separator className="my-4" />

                    {/* Settings Section */}
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Settings className="w-4 h-4 text-gray-600" />
                        <p className="text-sm font-semibold text-gray-700">Device Settings</p>
                      </div>

                      {/* Temperature Threshold */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Thermometer className="w-4 h-4 text-red-600" />
                          <Label className="text-xs font-medium text-gray-700">
                            Temperature Threshold
                          </Label>
                          <span className="text-xs font-semibold text-red-600 ml-auto">
                            {currentTemp.toFixed(0)}°C
                          </span>
                        </div>
                        {isEditing ? (
                          <>
                            <Slider
                              min={18}
                              max={50}
                              step={1}
                              value={[currentTemp]}
                              onValueChange={(value) =>
                                setTempSettings({
                                  ...tempSettings!,
                                  tempThreshold: value[0],
                                })
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>18°C</span>
                              <span>50°C</span>
                            </div>
                          </>
                        ) : (
                          <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
                            <p className="text-sm font-medium text-red-700">
                              Max: {currentTemp.toFixed(0)}°C
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Humidity Threshold */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Droplets className="w-4 h-4 text-cyan-600" />
                          <Label className="text-xs font-medium text-gray-700">
                            Humidity Threshold
                          </Label>
                          <span className="text-xs font-semibold text-cyan-600 ml-auto">
                            {currentHumidity.toFixed(0)}%
                          </span>
                        </div>
                        {isEditing ? (
                          <>
                            <Slider
                              min={40}
                              max={80}
                              step={1}
                              value={[currentHumidity]}
                              onValueChange={(value) =>
                                setTempSettings({
                                  ...tempSettings!,
                                  humidityThreshold: value[0],
                                })
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>40%</span>
                              <span>80%</span>
                            </div>
                          </>
                        ) : (
                          <div className="bg-cyan-50 border border-cyan-200 rounded px-3 py-2">
                            <p className="text-sm font-medium text-cyan-700">
                              Max: {currentHumidity.toFixed(0)}%
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Motion Threshold */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-purple-600" />
                          <Label className="text-xs font-medium text-gray-700">
                            Motion Threshold
                          </Label>
                          <span className="text-xs font-semibold text-purple-600 ml-auto">
                            {currentMotion.toFixed(0)}/10
                          </span>
                        </div>
                        {isEditing ? (
                          <>
                            <Slider
                              min={1}
                              max={10}
                              step={1}
                              value={[currentMotion]}
                              onValueChange={(value) =>
                                setTempSettings({
                                  ...tempSettings!,
                                  motionThreshold: value[0],
                                })
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>Low (1)</span>
                              <span>High (10)</span>
                            </div>
                          </>
                        ) : (
                          <div className="bg-purple-50 border border-purple-200 rounded px-3 py-2">
                            <p className="text-sm font-medium text-purple-700">
                              Level: {currentMotion.toFixed(0)}/10
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Distance Threshold = breach when at/closer than this (cm) */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-600" />
                          <Label className="text-xs font-medium text-gray-700">
                            Distance Threshold
                          </Label>
                          <span className="text-xs font-semibold text-blue-600 ml-auto">
                            {currentDistance.toFixed(0)} cm
                          </span>
                        </div>
                        {isEditing ? (
                          <>
                            <Slider
                              min={5}
                              max={10000}
                              step={1}
                              value={[Math.min(Math.max(currentDistance, 5), 10000)]}
                              onValueChange={(value) =>
                                setTempSettings({
                                  ...tempSettings!,
                                  distanceThreshold: value[0],
                                })
                              }
                              className="w-full"
                            />
                            <div className="flex justify-between text-xs text-gray-500">
                              <span>5 cm</span>
                              <span>10000 cm (100 m)</span>
                            </div>
                            <Input
                              type="number"
                              min={5}
                              max={10000}
                              step={1}
                              value={currentDistance}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (Number.isNaN(n)) return;
                                setTempSettings({
                                  ...tempSettings!,
                                  distanceThreshold: Math.min(10000, Math.max(5, n)),
                                });
                              }}
                              className="w-full h-8 text-sm"
                            />
                          </>
                        ) : (
                          <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2">
                            <p className="text-sm font-medium text-blue-700">
                              {currentDistance.toFixed(0)} cm
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      {isEditing ? (
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            onClick={() => handlePrepareSaveSensor(sensor.id)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            Save Changes
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleCancelEdit}
                            className="flex-1"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() =>
                            handleEditSensor(sensor.id, sensor.tempThreshold, sensor.humidityThreshold, sensor.motionThreshold, sensor.distanceThreshold)
                          }
                          className="w-full bg-gray-600 hover:bg-gray-700"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Edit Settings
                        </Button>
                      )}
                    </div>
                  </>
                )}

                {/* Last Updated */}
                <div className="pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Last updated: {sensor.lastUpdated.toLocaleTimeString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      </section>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Active Sensors</p>
              <p className="text-3xl font-bold text-gray-900">{activeSensors.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Active Warnings</p>
              <p className="text-3xl font-bold text-yellow-600">
                {activeSensors.filter((s) => s.status === "warning").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Critical Alerts</p>
              <p className="text-3xl font-bold text-red-600">
                {activeSensors.filter((s) => s.status === "critical").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Offline</p>
              <p className="text-3xl font-bold text-gray-500">
                {activeSensors.filter((s) => s.status === "offline").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
