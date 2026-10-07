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
import { Users, UserPlus, Mail, Phone, Edit, Archive, Bell, Shield } from "lucide-react";
import { toast } from "sonner";

export default function Settings() {
  const { contacts, addContact, updateContact, archiveContact } = useMuseum();
  const { managedUsers, addUser, archiveUser } = useAuth();

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
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [editingContact, setEditingContact] = useState<typeof contacts[0] | null>(null);

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

  const handleConfirmAddAccount = async () => {
    const account = { ...newAccount };
    setCreatingAccount(true);
    try {
      const result = await addUser(
        account.username,
        account.email,
        account.password,
        account.role
      );
      toast.success(
        result.linkedExistingAuth
          ? `${account.username} linked and added to Account Management as ${account.role}.`
          : `${account.username} created as ${account.role} and added to the table.`
      );
      setNewAccount({ username: "", email: "", password: "", role: "curator" });
      setConfirmAddAccountOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Failed to create account");
    } finally {
      setCreatingAccount(false);
    }
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Users</h1>
        <p className="text-gray-600 mt-1">Manage staff accounts and alert contacts</p>
      </div>

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
                  <DialogDescription>
                    Any admin can create admin or curator accounts. New users appear in the table below right away.
                  </DialogDescription>
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
                  <AlertDialogCancel onClick={handleCancelAddAccount} disabled={creatingAccount}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      void handleConfirmAddAccount();
                    }}
                    disabled={creatingAccount}
                    className="bg-purple-600 hover:bg-purple-700"
                  >
                    {creatingAccount ? "Creating..." : "Confirm Create"}
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
              {activeUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    No staff accounts yet. Create an admin or curator account to see it here.
                  </TableCell>
                </TableRow>
              ) : (
                activeUsers.map((account: any) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.username}</TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={account.role === "admin" ? "default" : "secondary"}
                        className={
                          account.role === "admin"
                            ? "bg-purple-600 hover:bg-purple-600 text-white"
                            : "bg-slate-200 text-slate-800 hover:bg-slate-200"
                        }
                      >
                        {account.role === "admin" ? "Admin" : "Curator"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {account.createdAt instanceof Date
                        ? account.createdAt.toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {account.lastLogin instanceof Date
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
                ))
              )}
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
