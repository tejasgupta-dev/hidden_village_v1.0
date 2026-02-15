"use client";

export default function AdminDashboardUI({
  users,
  loading,
  msg,
  error,
  actionLoading,
  onPromote,
  onDemote,
  onDelete,
}) {

  if (loading)
    return <p className="p-8">Loading users...</p>;

  return (

    <div className="p-8 max-w-4xl mx-auto">

      <h2 className="text-2xl font-bold mb-6">
        Admin Dashboard
      </h2>

      {msg && (
        <p className="text-green-600 mb-4">
          {msg}
        </p>
      )}

      {error && (
        <p className="text-red-600 mb-4">
          {error}
        </p>
      )}

      <ul className="space-y-3">

        {users.map((u) => {

          const isLoading = actionLoading === u.uid;

          return (

            <li
              key={u.uid}
              className="flex justify-between items-center p-4 border rounded-lg shadow-sm"
            >

              <div>

                <p className="font-medium">
                  {u.email || "No Email"}
                </p>

                <p className="text-sm text-gray-500">
                  Roles: {u.roles?.length
                    ? u.roles.join(", ")
                    : "user"}
                </p>

                {u.disabled && (
                  <p className="text-xs text-red-500">
                    Account Disabled
                  </p>
                )}

              </div>


              <div className="flex gap-2">

                {!u.roles?.includes("admin") && (
                  <button
                    disabled={isLoading}
                    onClick={() => onPromote(u.uid)}
                    className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-3 py-1 rounded"
                  >
                    Promote
                  </button>
                )}


                {u.roles?.includes("admin") && (
                  <button
                    disabled={isLoading}
                    onClick={() => onDemote(u.uid)}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white px-3 py-1 rounded"
                  >
                    Demote
                  </button>
                )}


                <button
                  disabled={isLoading}
                  onClick={() => onDelete(u.uid)}
                  className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white px-3 py-1 rounded"
                >
                  Delete
                </button>

              </div>

            </li>

          );

        })}

      </ul>

    </div>

  );

}
