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
import { Thermometer, Droplets, Radio, Archive, Settings, Activity, Target, Plus, Trash2 } from "lucide-react";
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
  DialogTrigger,
} from "../components/ui/dialog";

export default function Sensors() {
  const { sensors, archiveSensor, deleteSensor, updateSensorSettings, addSensor } = useMuseum();
  const { isAdmin } = useAuth();
  const [editingSensor, setEditingSensor] = useState<string | null>(null);
  const [tempSettings, setTempSettings] = useState<{
    tempThreshold: number;
    humidityThreshold: number;
    motionThreshold: number;
    distanceThreshold: number;
  } | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [confirmAddDialogOpen, setConfirmAddDialogOpen] = useState(false);
  const [confirmSaveDialogOpen, setConfirmSaveDialogOpen] = useState(false);
  const [savingSensorId, setSavingSensorId] = useState<string | null>(null);
  const [newSensorName, setNewSensorName] = useState("");
  const [newSensorLocation, setNewSensorLocation] = useState("");
  const [newSensorDeviceId, setNewSensorDeviceId] = useState("esp32_gallery_a_1");

  // Only show non-archived sensors
  const activeSensors = sensors.filter(s => !s.archived);

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

  const handlePrepareAddSensor = () => {
    if (newSensorName && newSensorLocation) {
      setAddDialogOpen(false);
      setConfirmAddDialogOpen(true);
    }
  };

  const handleConfirmAddSensor = () => {
    addSensor(newSensorName, newSensorLocation, newSensorDeviceId.trim() || undefined);
    setConfirmAddDialogOpen(false);
    setNewSensorName("");
    setNewSensorLocation("");
    setNewSensorDeviceId("esp32_gallery_a_1");
  };

  const handleCancelAddSensor = () => {
    setConfirmAddDialogOpen(false);
    setNewSensorName("");
    setNewSensorLocation("");
    setNewSensorDeviceId("esp32_gallery_a_1");
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sensor Monitoring</h1>
          <p className="text-gray-600 mt-1">Real-time status of all environmental sensors</p>
        </div>
        
        {/* Add Sensor Button */}
        {isAdmin && (
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Sensor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Sensor</DialogTitle>
                <DialogDescription>
                  Enter the details for the new sensor device.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="sensor-name" className="text-sm font-medium text-gray-700">Sensor Name</Label>
                  <Input
                    id="sensor-name"
                    placeholder="e.g., Gallery D - Artifact 1"
                    value={newSensorName}
                    onChange={(e) => setNewSensorName(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sensor-location" className="text-sm font-medium text-gray-700">Location</Label>
                  <Input
                    id="sensor-location"
                    placeholder="e.g., Gallery D"
                    value={newSensorLocation}
                    onChange={(e) => setNewSensorLocation(e.target.value)}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sensor-device-id" className="text-sm font-medium text-gray-700">
                    Hardware Device ID (ESP32)
                  </Label>
                  <Input
                    id="sensor-device-id"
                    placeholder="esp32_gallery_a_1"
                    value={newSensorDeviceId}
                    onChange={(e) => setNewSensorDeviceId(e.target.value)}
                    className="w-full font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500">
                    Must match the Arduino <code className="bg-gray-100 px-1 rounded">DEVICE_ID</code> and
                    Realtime Database path <code className="bg-gray-100 px-1 rounded">liveSensors/…</code>.
                    Leave empty only for a manual (non-ESP) sensor.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handlePrepareAddSensor}
                  disabled={!newSensorName || !newSensorLocation}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Add Sensor
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {/* Add Sensor Confirmation Dialog */}
        <AlertDialog open={confirmAddDialogOpen} onOpenChange={setConfirmAddDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Add Sensor</AlertDialogTitle>
              <AlertDialogDescription>
                Add "{newSensorName}" at "{newSensorLocation}"
                {newSensorDeviceId.trim()
                  ? ` linked to hardware ID "${newSensorDeviceId.trim()}" (Realtime DB)?`
                  : " as a manual sensor (not linked to ESP)?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelAddSensor}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmAddSensor}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Add
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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

      {/* Sensors Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-orange-300 text-orange-700 hover:bg-orange-50"
                        >
                          <Archive className="w-4 h-4 mr-1" />
                          Archive
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive Sensor</AlertDialogTitle>
                          <AlertDialogDescription>
                            Archive "{sensor.name}"? It will leave active monitoring; history is kept.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => archiveSensor(sensor.id)}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            Archive
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

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
                            Permanently delete "{sensor.name}"? To reconnect this ESP later, Add Sensor with the same Hardware Device ID.
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
