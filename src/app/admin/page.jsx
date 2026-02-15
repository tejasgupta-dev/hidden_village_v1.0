"use client";

import { useEffect, useState, useRef } from "react";
import AdminDashboardUI from "@/components/AdminDashboard";

export default function AdminDashboardPage() {

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [actionLoading, setActionLoading] = useState(null);

  const mountedRef = useRef(true);


  // Fetch users
  useEffect(() => {

    mountedRef.current = true;

    async function fetchUsers() {

      try {

        setLoading(true);

        const res = await fetch("/api/users", {
          credentials: "include",
          cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok || !data.success)
          throw new Error(data.message);

        if (mountedRef.current)
          setUsers(data.users || []);

      } catch (err) {

        setError(err.message);

      } finally {

        if (mountedRef.current)
          setLoading(false);

      }

    }

    fetchUsers();

    return () => {
      mountedRef.current = false;
    };

  }, []);


  const updateRole = async (uid, action) => {

    try {

      setActionLoading(uid);
      setMsg("");
      setError("");

      const res = await fetch(`/api/users/${uid}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (!res.ok || !data.success)
        throw new Error(data.message);

      setMsg(data.message);

      setUsers((prev) =>
        prev.map((u) => {

          if (u.uid !== uid) return u;

          if (action === "promote") {
            return {
              ...u,
              roles: [...new Set([...(u.roles || []), "admin"])],
            };
          }

          return {
            ...u,
            roles: (u.roles || []).filter(
              (r) => r !== "admin"
            ),
          };

        })
      );

    } catch (err) {

      setError(err.message);

    } finally {

      setActionLoading(null);

    }

  };


  const deleteUser = async (uid) => {

    if (!confirm("Delete this user?"))
      return;

    try {

      setActionLoading(uid);
      setMsg("");
      setError("");

      const res = await fetch(`/api/users/${uid}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await res.json();

      if (!res.ok || !data.success)
        throw new Error(data.message);

      setMsg(data.message);

      setUsers((prev) =>
        prev.filter((u) => u.uid !== uid)
      );

    } catch (err) {

      setError(err.message);

    } finally {

      setActionLoading(null);

    }

  };


  return (

    <AdminDashboardUI
      users={users}
      loading={loading}
      msg={msg}
      error={error}
      actionLoading={actionLoading}
      onPromote={(uid) =>
        updateRole(uid, "promote")
      }
      onDemote={(uid) =>
        updateRole(uid, "demote")
      }
      onDelete={deleteUser}
    />

  );

}
