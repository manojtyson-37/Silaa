import { api, User } from "@/lib/api";
import { requireAuth } from "@/lib/serverAuth";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const token = await requireAuth();
  const users = await api.get<User[]>("/users", token);

  return <UsersClient initialUsers={users} token={token} />;
}
