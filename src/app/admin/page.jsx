"use client";

import { useEffect, useState } from "react";

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // ================================
  // Fetch Users
  // ================================
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();

        if (!data.success) {
          setError(data.message || "Failed to fetch users");
          return;
        }

        setUsers(data.users || []);
      } catch (err) {
        console.error("Error fetching users:", err);
        setError("Server error while loading users.");
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, []);

  // ================================
  // Promote / Demote
  // ================================
  const updateRole = async (uid, action) => {
    try {
      setMsg("");
      setError("");

      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }), // "promote" | "demote"
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Action failed.");
        return;
      }

      setMsg(data.message);

      // Update UI locally
      setUsers((prev) =>
        prev.map((u) => {
          if (u.uid !== uid) return u;

          if (action === "promote") {
            return {
              ...u,
              roles: [...new Set([...(u.roles || []), "admin"])],
            };
          }

          if (action === "demote") {
            return {
              ...u,
              roles: (u.roles || []).filter((r) => r !== "admin"),
            };
          }

          return u;
        })
      );
    } catch (err) {
      console.error(err);
      setError("Server error.");
    }
  };

  // ================================
  // Delete User
  // ================================
  const deleteUser = async (uid) => {
    if (!confirm("Are you sure you want to permanently delete this user?"))
      return;

    try {
      setMsg("");
      setError("");

      const res = await fetch(`/api/admin/users/${uid}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.message || "Delete failed.");
        return;
      }

      setMsg(data.message);

      // Remove from UI
      setUsers((prev) => prev.filter((u) => u.uid !== uid));
    } catch (err) {
      console.error(err);
      setError("Server error.");
    }
  };

  // ================================
  // UI
  // ================================
  if (loading) return <p className="p-8">Loading users...</p>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>

      {msg && <p className="text-green-600 mb-4">{msg}</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <ul className="space-y-3">
        {users.map((u) => (
          <li
            key={u.uid}
            className="flex justify-between items-center p-4 border rounded-lg shadow-sm"
          >
            <div>
              <p className="font-medium">{u.email || "No Email"}</p>
              <p className="text-sm text-gray-500">
                Roles: {u.roles?.length ? u.roles.join(", ") : "user"}
              </p>
              {u.disabled && (
                <p className="text-xs text-red-500">Account Disabled</p>
              )}
            </div>

            <div className="flex gap-2">
              {!u.roles?.includes("admin") && (
                <button
                  onClick={() => updateRole(u.uid, "promote")}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                >
                  Promote
                </button>
              )}

              {u.roles?.includes("admin") && (
                <button
                  onClick={() => updateRole(u.uid, "demote")}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded"
                >
                  Demote
                </button>
              )}

              <button
                onClick={() => deleteUser(u.uid)}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
