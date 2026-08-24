import { useState } from 'react';
import { FileText, Printer, Filter, Calendar } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface IncidentReport {
  id: string;
  dateTime: string;
  location: string;
  incidentType: 'High Temperature' | 'High Humidity' | 'Motion Detected';
  recordedValue: string;
  status: 'Resolved' | 'Unresolved';
}

export function ReportsPage() {
  const { isAdmin } = useAuth();
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [dateFrom, setDateFrom] = useState('2026-03-20');
  const [dateTo, setDateTo] = useState('2026-03-23');
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const allReports: IncidentReport[] = [
    {
      id: '1',
      dateTime: 'March 20, 2026 - 2:45 PM',
      location: 'Gallery A - Artifact 1',
      incidentType: 'High Humidity',
      recordedValue: '65%',
      status: 'Resolved',
    },
    {
      id: '2',
      dateTime: 'March 21, 2026 - 10:30 AM',
      location: 'Gallery B - Artifact 1',
      incidentType: 'Motion Detected',
      recordedValue: 'Proximity breach',
      status: 'Unresolved',
    },
    {
      id: '3',
      dateTime: 'March 21, 2026 - 3:15 PM',
      location: 'Gallery A - Artifact 2',
      incidentType: 'High Temperature',
      recordedValue: '26.5°C',
      status: 'Resolved',
    },
    {
      id: '4',
      dateTime: 'March 22, 2026 - 11:20 AM',
      location: 'Gallery B - Artifact 2',
      incidentType: 'High Humidity',
      recordedValue: '68%',
      status: 'Unresolved',
    },
    {
      id: '5',
      dateTime: 'March 23, 2026 - 9:05 AM',
      location: 'Gallery A - Artifact 1',
      incidentType: 'Motion Detected',
      recordedValue: 'Unauthorized access',
      status: 'Resolved',
    },
  ];

  const filteredReports = allReports.filter(report => {
    if (selectedLocation !== 'all' && !report.location.includes(selectedLocation)) return false;
    if (selectedType !== 'all' && report.incidentType !== selectedType) return false;
    return true;
  });

  const handlePrint = () => {
    setShowPrintPreview(true);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const incidentTypeCounts = {
    temperature: filteredReports.filter(r => r.incidentType === 'High Temperature').length,
    humidity: filteredReports.filter(r => r.incidentType === 'High Humidity').length,
    motion: filteredReports.filter(r => r.incidentType === 'Motion Detected').length,
  };

  return (
    <>
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-report, #printable-report * {
            visibility: visible;
          }
          #printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 40px;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .print-table {
            border-collapse: collapse;
            width: 100%;
            margin-top: 20px;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background-color: #f3f4f6;
          }
        }
      `}</style>

      <div className="no-print">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Incident Reports</h2>
          <p className="text-sm text-gray-600">Hiyas Museum Smart Monitoring System</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filters</h3>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">Date From</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Date To</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Sensor/Location</label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Locations</option>
                <option value="Gallery A">Gallery A</option>
                <option value="Gallery B">Gallery B</option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-700 mb-1">Incident Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Types</option>
                <option value="High Temperature">Temperature</option>
                <option value="High Humidity">Humidity</option>
                <option value="Motion Detected">Motion</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          {isAdmin ? (
            <>
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                <FileText className="w-4 h-4" />
                Generate Report
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print Report
              </button>
            </>
          ) : (
            <div className="text-sm text-gray-600 italic">
              View-only access. Contact administrator for report generation.
            </div>
          )}
        </div>

        {/* Reports Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Incident Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Recorded Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{report.dateTime}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{report.location}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs ${
                          report.incidentType === 'High Temperature'
                            ? 'bg-red-100 text-red-800'
                            : report.incidentType === 'High Humidity'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {report.incidentType}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{report.recordedValue}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs ${
                          report.status === 'Resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {report.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredReports.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No incidents found matching the selected filters.
          </div>
        )}
      </div>

      {/* Printable Report */}
      <div id="printable-report" className="hidden print:block">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">Hiyas Museum Smart Monitoring System</h1>
          <h2 className="text-xl mb-4">Incident Report Summary</h2>
          <p className="text-sm text-gray-600">
            Generated on: {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Report Period: {dateFrom} to {dateTo}
          </p>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Location</th>
              <th>Incident Type</th>
              <th>Recorded Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report) => (
              <tr key={report.id}>
                <td>{report.dateTime}</td>
                <td>{report.location}</td>
                <td>{report.incidentType}</td>
                <td>{report.recordedValue}</td>
                <td>{report.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-8 p-4 border border-gray-300">
          <h3 className="font-bold mb-4">Summary</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm"><strong>Total Incidents:</strong> {filteredReports.length}</p>
              <p className="text-sm"><strong>Resolved:</strong> {filteredReports.filter(r => r.status === 'Resolved').length}</p>
              <p className="text-sm"><strong>Unresolved:</strong> {filteredReports.filter(r => r.status === 'Unresolved').length}</p>
            </div>
            <div>
              <p className="text-sm"><strong>Temperature Incidents:</strong> {incidentTypeCounts.temperature}</p>
              <p className="text-sm"><strong>Humidity Incidents:</strong> {incidentTypeCounts.humidity}</p>
              <p className="text-sm"><strong>Motion Incidents:</strong> {incidentTypeCounts.motion}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-600">
          <p>This is an official document of the Hiyas Museum Smart Monitoring System</p>
          <p className="mt-2">For inquiries, contact the museum administration office</p>
        </div>
      </div>
    </>
  );
}
