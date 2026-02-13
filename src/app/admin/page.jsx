"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const router = useRouter();

  useEffect(() => {
    async function fetchUsers() {
      const res = await fetch("/api/admin/get-users");
      const data = await res.json();
      setUsers(data.users || []);
      setLoading(false);
    }
    fetchUsers();
  }, []);

  const promoteUser = async (uid) => {
    const res = await fetch("/api/admin/promote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid }),
    });
    const data = await res.json();
    setMsg(data.message);
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div className="p-8">
      <h2 className="text-2xl font-bold mb-4">Admin Dashboard</h2>
      {msg && <p className="text-green-600">{msg}</p>}
      <ul>
        {users.map((u) => (
          <li key={u.uid} className="flex justify-between p-2 border rounded mb-2">
            <span>{u.email} ({u.roles?.join(", ") || "user"})</span>
            {!u.roles?.includes("admin") && (
              <button
                onClick={() => promoteUser(u.uid)}
                className="bg-blue-500 text-white px-3 py-1 rounded"
              >
                Promote to Admin
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
