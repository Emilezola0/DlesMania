// The one Firebase connection: the app, its sign-in and its database, shared by the cloud save
// (engine.ts) and trading (trades.ts). Only loaded with them.
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config';

export const app = initializeApp(FIREBASE_CONFIG);
export const auth = getAuth(app);
export const db = getFirestore(app);
