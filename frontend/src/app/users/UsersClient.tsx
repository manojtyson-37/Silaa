"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Edit2 } from "lucide-react";
import { Button, Card, Input } from "@/components/ui";
import { api, User } from "@/lib/api";

export default function UsersClient({ initialUsers, token }: { initialUsers: User[]; token: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  
  const [isAdding, setIsAdding] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("viewer");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("viewer");
  const [editActive, setEditActive] = useState(true);

  const handleAddUser = async () => {
    try {
      const u = await api.post<User>("/users", { username: newUsername, password: newPassword, role: newRole }, token);
      setUsers([...users, u]);
      setIsAdding(false);
      setNewUsername("");
      setNewPassword("");
      setNewRole("viewer");
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpdateUser = async (id: number) => {
    try {
      const u = await api.patch<User>(`/users/${id}`, {
        password: editPassword || undefined,
        role: editRole,
        is_active: editActive
      }, token);
      setUsers(users.map(user => user.id === id ? u : user));
      setEditingId(null);
      setEditPassword("");
      router.refresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <main className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage staff roles and access.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)}>
          <Plus size={16} /> Add User
        </Button>
      </div>

      {isAdding && (
        <Card className="p-4 mb-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold">New User</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input placeholder="Username" value={newUsername} onChange={e => setNewUsername(e.target.value)} />
            <Input type="password" placeholder="Password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            <select
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <Button onClick={handleAddUser} disabled={!newUsername || !newPassword}>Save</Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {users.map(user => (
          <Card key={user.id} className="p-4 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{user.username}</h3>
                <span className="inline-flex items-center rounded-md bg-secondary/20 px-2 py-1 text-xs font-medium text-secondary ring-1 ring-inset ring-secondary/20 mt-1">
                  {user.role}
                </span>
                {!user.is_active && (
                  <span className="ml-2 inline-flex items-center rounded-md bg-destructive/20 px-2 py-1 text-xs font-medium text-destructive ring-1 ring-inset ring-destructive/20 mt-1">
                    Inactive
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setEditingId(user.id);
                  setEditRole(user.role);
                  setEditActive(user.is_active);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Edit2 size={16} />
              </button>
            </div>
            
            {editingId === user.id && (
              <div className="flex flex-col gap-3 mt-2 border-t border-border pt-3">
                <Input type="password" placeholder="New Password (optional)" value={editPassword} onChange={e => setEditPassword(e.target.value)} />
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="admin">Admin</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editActive} onChange={e => setEditActive(e.target.checked)} />
                  Active Account
                </label>
                <div className="flex gap-2">
                  <Button onClick={() => handleUpdateUser(user.id)} className="flex-1">Update</Button>
                  <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </main>
  );
}
