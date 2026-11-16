// The Firebase project's web config. Not a secret: it only says which project to talk to; the
// security rules (firestore.rules) are what keep each player's save their own.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBbxrMEITSlVECiTZoetGiFzjTM1aZXbAQ',
  authDomain: 'omnidle-f2d71.firebaseapp.com',
  projectId: 'omnidle-f2d71',
  storageBucket: 'omnidle-f2d71.firebasestorage.app',
  messagingSenderId: '911865346579',
  appId: '1:911865346579:web:e0b35398933d3854ac1de6',
};

/**
 * The Realtime Database (who's on an island right now, live: src/cloud/presence.ts), in Belgium (europe-west1). Its
 * address is the one the Firebase console shows (Realtime Database → Data, at the top) once the database is made; if it
 * was made in another region, put that address here. Until it exists, the island's presence stays on Firestore.
 */
export const DATABASE_URL = 'https://omnidle-f2d71-default-rtdb.europe-west1.firebasedatabase.app';
