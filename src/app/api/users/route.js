import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/firebase/requireSession";
import { auth } from "@/lib/firebase/firebaseAdmin";

export const runtime = "nodejs";

export async function GET(req) {
  const { success, response } = await requireAdmin(req);
  if (!success) return response;

  try {
    let users = [];
    let pageToken = undefined;

    do {
      const result = await auth.listUsers(1000, pageToken);

      users.push(
        ...result.users.map((u) => ({
          uid: u.uid,
          email: u.email ?? null,
          roles: Array.isArray(u.customClaims?.roles)
            ? u.customClaims.roles
            : [],
          disabled: u.disabled ?? false,
        }))
      );

      pageToken = result.pageToken;

    } while (pageToken);

    return NextResponse.json({
      success: true,
      users,
    });

  } catch (err) {
    console.error(err);

    return NextResponse.json(
      { success: false, message: "Server error." },
      { status: 500 }
    );
  }
}
