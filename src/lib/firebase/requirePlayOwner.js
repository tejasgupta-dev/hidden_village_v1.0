import { ref, get } from "firebase/database";
import { db } from "./firebaseClient";

export async function requirePlayOwner(playId, uid) {

  const snap =
    await get(ref(db, `plays/${playId}/metadata/ownerUid`));

  if (!snap.exists())
    return false;

  return snap.val() === uid;

}
