import { useState, useMemo } from 'react';
import { useMuseum } from '../context/MuseumContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { FileText, Printer, Download, Filter } from 'lucide-react';

export default function Reports() {
  const { alerts, sensors } = useMuseum();
  
  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedArtifact, setSelectedArtifact] = useState('all');

  // Get unique locations from sensors
  const locations = useMemo(() => {
    const uniqueLocations = Array.from(new Set(sensors.map(s => s.location)));
    return uniqueLocations.sort();
  }, [sensors]);

  // Get unique artifacts from sensors
  const artifacts = useMemo(() => {
    const uniqueArtifacts = Array.from(new Set(sensors.map(s => s.name)));
    return uniqueArtifacts.sort();
  }, [sensors]);

  // Filter alerts based on date, location, and artifact
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Find sensor for this alert to get location and name
      const sensor = sensors.find(s => s.id === alert.sensorId);

      // Location filter
      if (selectedLocation !== 'all' && sensor?.location !== selectedLocation) {
        return false;
      }

      // Artifact filter
      if (selectedArtifact !== 'all' && sensor?.name !== selectedArtifact) {
        return false;
      }

      // Date filters
      if (startDate) {
        const alertDate = new Date(alert.timestamp);
        const filterStartDate = new Date(startDate);
        filterStartDate.setHours(0, 0, 0, 0);
        if (alertDate < filterStartDate) {
          return false;
        }
      }

      if (endDate) {
        const alertDate = new Date(alert.timestamp);
        const filterEndDate = new Date(endDate);
        filterEndDate.setHours(23, 59, 59, 999);
        if (alertDate > filterEndDate) {
          return false;
        }
      }

      return true;
    });
  }, [alerts, sensors, startDate, endDate, selectedLocation, selectedArtifact]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    // Simple CSV export
    const csvContent = filteredAlerts.map(alert => {
      const sensor = sensors.find(s => s.id === alert.sensorId);
      return `${alert.timestamp.toLocaleString()},${sensor?.location || 'Unknown'},${alert.type},${alert.severity},${alert.message}`;
    }).join('\n');
    
    const blob = new Blob([`Date,Location,Type,Severity,Message\n${csvContent}`], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'museum-alerts-report.csv';
    a.click();
  };

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedLocation('all');
    setSelectedArtifact('all');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incident Reports</h1>
          <p className="text-gray-600 mt-1">View and export system alerts and incidents</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={handleExport} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <CardTitle className="text-lg">Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger id="location">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {locations.map(location => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Artifact */}
            <div className="space-y-2">
              <Label htmlFor="artifact">Artifact</Label>
              <Select value={selectedArtifact} onValueChange={setSelectedArtifact}>
                <SelectTrigger id="artifact">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Artifacts</SelectItem>
                  {artifacts.map(artifact => (
                    <SelectItem key={artifact} value={artifact}>
                      {artifact}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleClearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>

          {/* Filter Summary */}
          {(startDate || endDate || selectedLocation !== 'all' || selectedArtifact !== 'all') && (
            <div className="mt-4 flex gap-2 flex-wrap">
              {startDate && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  From: {new Date(startDate).toLocaleDateString()}
                </Badge>
              )}
              {endDate && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  To: {new Date(endDate).toLocaleDateString()}
                </Badge>
              )}
              {selectedLocation !== 'all' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Location: {selectedLocation}
                </Badge>
              )}
              {selectedArtifact !== 'all' && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  Artifact: {selectedArtifact}
                </Badge>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total Alerts</p>
              <p className="text-3xl font-bold text-gray-900">{filteredAlerts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Critical Incidents</p>
              <p className="text-3xl font-bold text-red-600">
                {filteredAlerts.filter(a => a.severity === 'critical').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Acknowledged</p>
              <p className="text-3xl font-bold text-green-600">
                {filteredAlerts.filter(a => a.acknowledged).length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Table */}
      <Card className="print-section">
        <CardHeader>
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-600" />
            <CardTitle>Alert History</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No alerts found matching the selected filters
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date & Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Location</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Severity</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Message</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAlerts.map((alert) => {
                    const sensor = sensors.find(s => s.id === alert.sensorId);
                    return (
                      <tr key={alert.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {alert.timestamp.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {sensor?.location || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-sm capitalize">
                          <Badge className={
                            alert.type === 'security' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-blue-100 text-blue-700'
                          }>
                            {alert.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Badge className={
                            alert.severity === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }>
                            {alert.severity}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {alert.message}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {alert.acknowledged ? (
                            <Badge className="bg-green-100 text-green-700">Acknowledged</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-700">Pending</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
          }
          button {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
