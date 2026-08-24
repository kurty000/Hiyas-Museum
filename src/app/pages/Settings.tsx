import { useState } from "react";
import { useMuseum } from "../context/MuseumContext";
import { useAuth } from "../context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Badge } from "../components/ui/badge";
import { Users, UserPlus, Mail, Phone, Edit, Archive, Bell, Shield, Settings as SettingsIcon, Clock, Database, Wifi, Server } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { contacts, addContact, updateContact, archiveContact, settings, updateSettings } = useMuseum();
  const { managedUsers, addUser, archiveUser, isAdmin } = useAuth();

  // Only show active (non-archived) contacts and users
  const activeContacts = contacts.filter((c: any) => !c.archived);
  const activeUsers = managedUsers.filter((u: any) => !u.archived);

  // New Contact Form State
  const [newContact, setNewContact] = useState({
    name: "",
    role: "",
    email: "",
    phone: "",
    alertTypes: [] as string[],
  });

  // New Staff Account Form State
  const [newAccount, setNewAccount] = useState({
    username: "",
    email: "",
    password: "",
    role: "curator" as "admin" | "curator",
  });

  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [confirmAddContactOpen, setConfirmAddContactOpen] = useState(false);
  const [confirmAddAccountOpen, setConfirmAddAccountOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<typeof contacts[0] | null>(null);

  // System settings form state
  const [reportingInterval, setReportingInterval] = useState(settings.reportingIntervalSeconds.toString());
  const [dataRetention, setDataRetention] = useState(settings.dataRetentionMonths.toString());
  const [wifiSSID, setWifiSSID] = useState(settings.wifiSSID || "");
  const [wifiPassword, setWifiPassword] = useState(settings.wifiPassword || "");
  const [mqttBroker, setMqttBroker] = useState(settings.mqttBroker || "");
  const [mqttPort, setMqttPort] = useState(settings.mqttPort || "");
  const [mqttTopic, setMqttTopic] = useState(settings.mqttTopic || "");

  // Contact Management Functions
  const handlePrepareAddContact = () => {
    if (!newContact.name || !newContact.email || !newContact.phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsContactDialogOpen(false);
    setConfirmAddContactOpen(true);
  };

  const handleConfirmAddContact = () => {
    addContact(newContact);
    setNewContact({ name: "", role: "", email: "", phone: "", alertTypes: [] });
    setConfirmAddContactOpen(false);
  };

  const handleCancelAddContact = () => {
    setConfirmAddContactOpen(false);
    setNewContact({ name: "", role: "", email: "", phone: "", alertTypes: [] });
  };

  const handleUpdateContact = () => {
    if (!editingContact) return;
    updateContact(editingContact);
    setEditingContact(null);
  };

  // Account Management Functions
  const handlePrepareAddAccount = () => {
    if (!newAccount.username || !newAccount.email || !newAccount.password) {
      toast.error("Please fill in all required fields");
      return;
    }
    setIsAccountDialogOpen(false);
    setConfirmAddAccountOpen(true);
  };

  const handleConfirmAddAccount = () => {
    addUser(newAccount.username, newAccount.email, newAccount.password, newAccount.role);
    setNewAccount({ username: "", email: "", password: "", role: "curator" });
    setConfirmAddAccountOpen(false);
  };

  const handleCancelAddAccount = () => {
    setConfirmAddAccountOpen(false);
    setNewAccount({ username: "", email: "", password: "", role: "curator" });
  };

  const handleArchiveAccount = (id: string) => {
    archiveUser(id);
  };

  const toggleAlertType = (type: string) => {
    const currentTypes = editingContact ? editingContact.alertTypes : newContact.alertTypes;
    const updatedTypes = currentTypes.includes(type)
      ? currentTypes.filter((t: any) => t !== type)
      : [...currentTypes, type];

    if (editingContact) {
      setEditingContact({ ...editingContact, alertTypes: updatedTypes });
    } else {
      setNewContact({ ...newContact, alertTypes: updatedTypes });
    }
  };

  const handleSaveSystemSettings = () => {
    const intervalNum = parseInt(reportingInterval, 10);
    const retentionNum = parseInt(dataRetention, 10);
    if (isNaN(intervalNum) || intervalNum < 5) {
      toast.error("Reporting interval must be at least 5 seconds");
      return;
    }
    if (isNaN(retentionNum) || retentionNum < 1) {
      toast.error("Data retention must be at least 1 month");
      return;
    }
    updateSettings({
      ...settings,
      reportingIntervalSeconds: intervalNum,
      dataRetentionMonths: retentionNum,
      wifiSSID,
      wifiPassword,
      mqttBroker,
      mqttPort,
      mqttTopic
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
        <p className="text-gray-600 mt-1">Manage staff accounts and alert contacts</p>
      </div>

      {/* System Configuration Section (Admin Only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2 rounded-lg">
                <SettingsIcon className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>
                  Configure reporting intervals and data retention policies
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Reporting Interval */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <Label htmlFor="reporting-interval" className="text-sm font-medium">
                    Node Reporting Interval (seconds)
                  </Label>
                </div>
                <Input
                  id="reporting-interval"
                  type="number"
                  min={5}
                  value={reportingInterval}
                  onChange={(e: any) => setReportingInterval(e.target.value)}
                />
                <p className="text-xs text-gray-500">Default: 15 seconds. Minimum: 5 seconds.</p>
              </div>

              {/* Data Retention */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-green-600" />
                  <Label htmlFor="data-retention" className="text-sm font-medium">
                    Data Retention (months)
                  </Label>
                </div>
                <Input
                  id="data-retention"
                  type="number"
                  min={1}
                  value={dataRetention}
                  onChange={(e: any) => setDataRetention(e.target.value)}
                />
                <p className="text-xs text-gray-500">Default: 12 months. Historical records are purged after this.</p>
              </div>

              {/* Wi-Fi Configuration */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-blue-500" />
                  <Label htmlFor="wifi-ssid" className="text-sm font-medium">
                    Wi-Fi SSID
                  </Label>
                </div>
                <Input
                  id="wifi-ssid"
                  placeholder="Museum-IoT-Net"
                  value={wifiSSID}
                  onChange={(e: any) => setWifiSSID(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-gray-400" />
                  <Label htmlFor="wifi-password" className="text-sm font-medium">
                    Wi-Fi Password
                  </Label>
                </div>
                <Input
                  id="wifi-password"
                  type="password"
                  placeholder="••••••••"
                  value={wifiPassword}
                  onChange={(e: any) => setWifiPassword(e.target.value)}
                />
              </div>

              {/* MQTT Configuration */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-purple-500" />
                  <Label htmlFor="mqtt-broker" className="text-sm font-medium">
                    MQTT Broker
                  </Label>
                </div>
                <Input
                  id="mqtt-broker"
                  placeholder="mqtt.museum.local"
                  value={mqttBroker}
                  onChange={(e: any) => setMqttBroker(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-gray-400" />
                  <Label htmlFor="mqtt-port" className="text-sm font-medium">
                    MQTT Port
                  </Label>
                </div>
                <Input
                  id="mqtt-port"
                  placeholder="1883"
                  value={mqttPort}
                  onChange={(e: any) => setMqttPort(e.target.value)}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-gray-400" />
                  <Label htmlFor="mqtt-topic" className="text-sm font-medium">
                    MQTT Base Topic
                  </Label>
                </div>
                <Input
                  id="mqtt-topic"
                  placeholder="museum/sensors/+"
                  value={mqttTopic}
                  onChange={(e: any) => setMqttTopic(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={handleSaveSystemSettings} className="bg-blue-600 hover:bg-blue-700">
                Save Configuration
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contact Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <Bell className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Contact Management</CardTitle>
                <CardDescription>
                  Manage security personnel and curators who receive SMS or Email alerts
                </CardDescription>
              </div>
            </div>
            <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                  <DialogDescription>
                    Add a new contact to receive system alerts
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Full Name *</Label>
                    <Input
                      id="contact-name"
                      placeholder="John Smith"
                      value={newContact.name}
                      onChange={(e: any) => setNewContact({ ...newContact, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-role">Role/Position</Label>
                    <Input
                      id="contact-role"
                      placeholder="Security Chief"
                      value={newContact.role}
                      onChange={(e: any) => setNewContact({ ...newContact, role: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email *</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="john.smith@museum.com"
                      value={newContact.email}
                      onChange={(e: any) => setNewContact({ ...newContact, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Phone Number *</Label>
                    <Input
                      id="contact-phone"
                      placeholder="+1 (555) 123-4567"
                      value={newContact.phone}
                      onChange={(e: any) => setNewContact({ ...newContact, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Alert Types</Label>
                    <div className="flex flex-wrap gap-2">
                      {["security", "environmental", "critical"].map((type) => (
                        <Badge
                          key={type}
                          variant={newContact.alertTypes.includes(type) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleAlertType(type)}
                        >
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handlePrepareAddContact} className="bg-blue-600 hover:bg-blue-700">
                    Add Contact
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Contact Confirmation Dialog */}
            <AlertDialog open={confirmAddContactOpen} onOpenChange={setConfirmAddContactOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Add Contact</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to add {newContact.name} as a contact? They will receive alerts based on their preferences.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={handleCancelAddContact}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmAddContact}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Confirm Add
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Alert Types</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeContacts.map((contact: any) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.role}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-3 h-3 text-gray-400" />
                        <span>{contact.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3 h-3 text-gray-400" />
                        <span>{contact.phone}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {contact.alertTypes.map((type: string) => (
                        <Badge key={type} variant="secondary" className="text-xs">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingContact(contact)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Edit Contact</DialogTitle>
                            <DialogDescription>Update contact information</DialogDescription>
                          </DialogHeader>
                          {editingContact && (
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-contact-name">Full Name</Label>
                                <Input
                                  id="edit-contact-name"
                                  value={editingContact.name}
                                  onChange={(e: any) =>
                                    setEditingContact({ ...editingContact, name: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-contact-role">Role/Position</Label>
                                <Input
                                  id="edit-contact-role"
                                  value={editingContact.role}
                                  onChange={(e: any) =>
                                    setEditingContact({ ...editingContact, role: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-contact-email">Email</Label>
                                <Input
                                  id="edit-contact-email"
                                  type="email"
                                  value={editingContact.email}
                                  onChange={(e: any) =>
                                    setEditingContact({ ...editingContact, email: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-contact-phone">Phone Number</Label>
                                <Input
                                  id="edit-contact-phone"
                                  value={editingContact.phone}
                                  onChange={(e: any) =>
                                    setEditingContact({ ...editingContact, phone: e.target.value })
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Alert Types</Label>
                                <div className="flex flex-wrap gap-2">
                                  {["security", "environmental", "critical"].map((type) => (
                                    <Badge
                                      key={type}
                                      variant={
                                        editingContact.alertTypes.includes(type)
                                          ? "default"
                                          : "outline"
                                      }
                                      className="cursor-pointer"
                                      onClick={() => toggleAlertType(type)}
                                    >
                                      {type}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingContact(null)}>
                              Cancel
                            </Button>
                            <Button
                              onClick={handleUpdateContact}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              Update Contact
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                          >
                            <Archive className="w-4 h-4 text-orange-500" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive Contact</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to archive {contact.name}? Historical records will be preserved. They will no longer receive alerts.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => archiveContact(contact.id)}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              Archive
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Account Management Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Account Management</CardTitle>
                <CardDescription>
                  Create, update, or archive accounts for staff members
                </CardDescription>
              </div>
            </div>
            <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-purple-600 hover:bg-purple-700">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Create Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Staff Account</DialogTitle>
                  <DialogDescription>Add a new staff member account</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="account-username">Username *</Label>
                    <Input
                      id="account-username"
                      placeholder="john.smith"
                      value={newAccount.username}
                      onChange={(e: any) => setNewAccount({ ...newAccount, username: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-email">Email *</Label>
                    <Input
                      id="account-email"
                      type="email"
                      placeholder="john.smith@museum.com"
                      value={newAccount.email}
                      onChange={(e: any) => setNewAccount({ ...newAccount, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-password">Password *</Label>
                    <Input
                      id="account-password"
                      type="password"
                      placeholder="••••••••"
                      value={newAccount.password}
                      onChange={(e: any) => setNewAccount({ ...newAccount, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="account-role">Role *</Label>
                    <Select
                      value={newAccount.role}
                      onValueChange={(value: "admin" | "curator") =>
                        setNewAccount({ ...newAccount, role: value })
                      }
                    >
                      <SelectTrigger id="account-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="curator">Curator (View Only)</SelectItem>
                        <SelectItem value="admin">Admin (Full Access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handlePrepareAddAccount} className="bg-purple-600 hover:bg-purple-700">
                    Create Account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Account Confirmation Dialog */}
            <AlertDialog open={confirmAddAccountOpen} onOpenChange={setConfirmAddAccountOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Create Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to create an account for {newAccount.username} with {newAccount.role} privileges?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={handleCancelAddAccount}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConfirmAddAccount}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    Confirm Create
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers.map((account: any) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">{account.username}</TableCell>
                  <TableCell>{account.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={account.role === "admin" ? "default" : "secondary"}
                      className={
                        account.role === "admin" ? "bg-purple-600" : ""
                      }
                    >
                      {account.role === "admin" ? "👑 Admin" : "👤 Curator"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {account.createdAt.toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {account.lastLogin
                      ? account.lastLogin.toLocaleDateString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={account.username === "admin"}
                        >
                          <Archive
                            className={`w-4 h-4 ${
                              account.username === "admin" ? "text-gray-300" : "text-orange-500"
                            }`}
                          />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Archive Account</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to archive the account for {account.username}? Historical data will be preserved but they will lose access to the system.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleArchiveAccount(account.id)}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            Archive
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="bg-blue-100 p-3 rounded-lg h-fit">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">User Management Tips</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• Contacts will receive alerts via Telegram and email based on their preferences</li>
                <li>• Admin accounts can modify settings and manage users</li>
                <li>• Curator accounts can view dashboards, configure thresholds, and acknowledge alerts</li>
                <li>• The main admin account cannot be archived for security</li>
                <li>• Archived contacts and accounts retain their historical data</li>
                <li>• Accounts are locked after 3 consecutive failed login attempts</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
