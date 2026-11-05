// A completed album, told to everyone: albums/<uid> holds who completed it (their account's name, never
// their email), how many cards the album had then, and when. Written here (Firebase, signed in); read by
// everyone through Firestore's REST API (src/components/AlbumNews.tsx), so players without an account
// see it too without loading Firebase. firestore.rules lets each player write only their own.
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

/** Tells everyone this player completed their album (again, when new cards came and they got them all). */
export async function announceAlbum(cards: number): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  await setDoc(doc(db, 'albums', u.uid), { uid: u.uid, name: (u.displayName ?? '').trim().slice(0, 40) || 'A player', cards, at: Date.now() });
  return u.uid;
}
