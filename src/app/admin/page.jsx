"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  // Fetch all users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/admin/list-users");
        const data = await res.json();
        setUsers(data.users || []);
      } catch (err) {
        console.error("Error fetching users:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  // Promote user
  const promoteUser = async (uid) => {
    try {
      const res = await fetch("/api/admin/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      setMsg(data.message);

      // Refresh users list
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid ? { ...u, roles: [...(u.roles || []), "admin"] } : u
        )
      );
    } catch (err) {
      console.error(err);
      setMsg("Promotion failed");
    }
  };

  // Demote user
  const demoteUser = async (uid) => {
    if (!confirm("Are you sure you want to revoke admin rights for this user?")) return;

    try {
      const res = await fetch("/api/admin/demote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid }),
      });
      const data = await res.json();
      setMsg(data.message);

      // Refresh users list
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === uid
            ? { ...u, roles: (u.roles || []).filter((r) => r !== "admin") }
            : u
        )
      );
    } catch (err) {
      console.error(err);
      setMsg("Demotion failed");
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
      {msg && <p className="text-green-600 mb-4">{msg}</p>}

      <ul>
        {users.map((u) => (
          <li
            key={u.uid}
            className="flex justify-between items-center p-2 border rounded mb-2"
          >
            <span>{u.email} ({u.roles?.join(", ") || "user"})</span>
            <div className="flex gap-2">
              {!u.roles?.includes("admin") && (
                <button
                  onClick={() => promoteUser(u.uid)}
                  className="bg-blue-500 text-white px-3 py-1 rounded"
                >
                  Promote to Admin
                </button>
              )}
              {u.roles?.includes("admin") && (
                <button
                  onClick={() => demoteUser(u.uid)}
                  className="bg-red-500 text-white px-3 py-1 rounded"
                >
                  Demote Admin
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
