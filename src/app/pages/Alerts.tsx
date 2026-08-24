import { useState, useMemo } from "react";
import { useMuseum } from "../context/MuseumContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { AlertTriangle, Shield, CheckCircle, Check, Clock } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";

export default function Alerts() {
  const { alerts, sensors, acknowledgeAlert } = useMuseum();
  const [filterType, setFilterType] = useState<"all" | "environmental" | "security">("all");
  const [filterLocation, setFilterLocation] = useState<string>("all");
  const [filterArtifact, setFilterArtifact] = useState<string>("all");

  const uniqueLocations = useMemo(() => {
    const locs = new Set(sensors.map((s: any) => s.location));
    return Array.from(locs);
  }, [sensors]);

  const uniqueArtifacts = useMemo(() => {
    const filteredSensors = filterLocation === "all" ? sensors : sensors.filter((s: any) => s.location === filterLocation);
    const names = new Set(filteredSensors.map((s: any) => s.name));
    return Array.from(names);
  }, [sensors, filterLocation]);

  const filteredAlerts = alerts.filter((alert: any) => {
    if (filterType !== "all" && alert.type !== filterType) return false;
    
    if (filterLocation !== "all" || filterArtifact !== "all") {
      const sensor = sensors.find((s: any) => s.id === alert.sensorId);
      if (!sensor) return false;
      if (filterLocation !== "all" && sensor.location !== filterLocation) return false;
      if (filterArtifact !== "all" && sensor.name !== filterArtifact) return false;
    }

    return true;
  });

  const unacknowledgedAlerts = filteredAlerts.filter((a: any) => !a.acknowledged);
  const acknowledgedAlerts = filteredAlerts.filter((a: any) => a.acknowledged);

  const getSeverityBadge = (severity: string) => {
    if (severity === "critical") {
      return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Critical</Badge>;
    }
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">Warning</Badge>;
  };

  const getTypeIcon = (type: string) => {
    if (type === "security") {
      return <Shield className="w-5 h-5 text-red-600" />;
    }
    return <AlertTriangle className="w-5 h-5 text-orange-600" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600 mt-1">Monitor and acknowledge system alerts</p>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-3">
            <div className="text-center">
              <p className="text-sm text-gray-600">Unacknowledged</p>
              <p className="text-2xl font-bold text-red-600">{unacknowledgedAlerts.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Acknowledged</p>
              <p className="text-2xl font-bold text-green-600">{acknowledgedAlerts.length}</p>
            </div>
          </div>
          {/* NOTE: "Clear All" / "Delete" buttons intentionally removed per PRD F-04.
              System-generated alerts must never be permanently deleted to maintain audit log. */}
        </div>
      </div>

      {/* Filter Tabs and Dropdowns */}
      <div className="flex flex-col md:flex-row gap-6 md:items-end">
        <div className="flex gap-2">
          <Button
            variant={filterType === "all" ? "default" : "outline"}
            onClick={() => setFilterType("all")}
          >
            All Types
          </Button>
          <Button
            variant={filterType === "environmental" ? "default" : "outline"}
            onClick={() => setFilterType("environmental")}
          >
            Environmental
          </Button>
          <Button
            variant={filterType === "security" ? "default" : "outline"}
            onClick={() => setFilterType("security")}
          >
            Security
          </Button>
        </div>

        <div className="flex gap-4 flex-1">
          <div className="space-y-1 flex-1 max-w-[250px]">
            <Label htmlFor="location-filter" className="text-xs text-gray-500">Filter by Gallery/Location</Label>
            <Select value={filterLocation} onValueChange={(val) => { setFilterLocation(val); setFilterArtifact("all"); }}>
              <SelectTrigger id="location-filter">
                <SelectValue placeholder="All Locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 flex-1 max-w-[250px]">
            <Label htmlFor="artifact-filter" className="text-xs text-gray-500">Filter by Artifact</Label>
            <Select value={filterArtifact} onValueChange={setFilterArtifact}>
              <SelectTrigger id="artifact-filter">
                <SelectValue placeholder="All Artifacts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Artifacts</SelectItem>
                {uniqueArtifacts.map(art => (
                  <SelectItem key={art} value={art}>{art}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Alerts Tabs */}
      <Tabs defaultValue="unacknowledged" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="unacknowledged">
            Unacknowledged ({unacknowledgedAlerts.length})
          </TabsTrigger>
          <TabsTrigger value="acknowledged">
            Acknowledged ({acknowledgedAlerts.length})
          </TabsTrigger>
        </TabsList>

        {/* Unacknowledged Alerts */}
        <TabsContent value="unacknowledged" className="space-y-4">
          {unacknowledgedAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                  <p className="text-lg font-medium">No unacknowledged alerts</p>
                  <p className="text-sm mt-1">All alerts have been addressed</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            unacknowledgedAlerts.map((alert: any) => (
              <Card
                key={alert.id}
                className={`border-l-4 ${
                  alert.severity === "critical"
                    ? "border-l-red-500 bg-red-50"
                    : "border-l-yellow-500 bg-yellow-50"
                }`}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getTypeIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getSeverityBadge(alert.severity)}
                          <Badge
                            variant="outline"
                            className={
                              alert.type === "security"
                                ? "border-red-300 text-red-700"
                                : "border-orange-300 text-orange-700"
                            }
                          >
                            {alert.type === "security" ? "Security" : "Environmental"}
                          </Badge>
                          {alert.escalated && (
                            <Badge className="bg-orange-500 text-white hover:bg-orange-500">
                              <Clock className="w-3 h-3 mr-1" />
                              Escalated
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{alert.message}</CardTitle>
                        <p className="text-sm text-gray-600 mt-2">
                          {alert.timestamp.toLocaleString()}
                        </p>
                        {alert.escalated && alert.escalatedAt && (
                          <p className="text-xs text-orange-600 mt-1">
                            Escalated at {alert.escalatedAt.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => acknowledgeAlert(alert.id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Acknowledged Alerts */}
        <TabsContent value="acknowledged" className="space-y-4">
          {acknowledgedAlerts.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p className="text-lg font-medium">No acknowledged alerts</p>
                  <p className="text-sm mt-1">Acknowledged alerts will appear here</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            acknowledgedAlerts.map((alert: any) => (
              <Card key={alert.id} className="border-l-4 border-l-green-400 bg-green-50/50">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getTypeIcon(alert.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {getSeverityBadge(alert.severity)}
                          <Badge
                            variant="outline"
                            className="border-gray-400 text-gray-700"
                          >
                            {alert.type === "security" ? "Security" : "Environmental"}
                          </Badge>
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                            ✓ Acknowledged
                          </Badge>
                        </div>
                        <CardTitle className="text-lg text-gray-700">
                          {alert.message}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-2">
                          {alert.timestamp.toLocaleString()}
                        </p>
                        {alert.acknowledgedAt && (
                          <p className="text-xs text-green-600 mt-1">
                            Acknowledged by {alert.acknowledgedBy} at {alert.acknowledgedAt.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Alert Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600 mb-1">Total Alerts</p>
              <p className="text-2xl font-bold text-gray-900">{alerts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <p className="text-sm text-gray-600 mb-1">Critical</p>
              <p className="text-2xl font-bold text-red-600">
                {alerts.filter((a: any) => a.severity === "critical").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-500" />
              <p className="text-sm text-gray-600 mb-1">Environmental</p>
              <p className="text-2xl font-bold text-orange-600">
                {alerts.filter((a: any) => a.type === "environmental").length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Shield className="w-8 h-8 mx-auto mb-2 text-blue-500" />
              <p className="text-sm text-gray-600 mb-1">Security</p>
              <p className="text-2xl font-bold text-blue-600">
                {alerts.filter((a: any) => a.type === "security").length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}