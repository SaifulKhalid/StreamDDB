/// <reference types="vite/client" />
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Support full portability and custom deployment configs via environment variables
const firebaseConfig = {
  apiKey: (import.meta.env.VITE_FIREBASE_API_KEY as string) || "AIzaSyDua-qPYK1xJ5wEsvyjSNouXEkx4GZrVr4",
  authDomain: (import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string) || "gen-lang-client-0552105030.firebaseapp.com",
  projectId: (import.meta.env.VITE_FIREBASE_PROJECT_ID as string) || "gen-lang-client-0552105030",
  storageBucket: (import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string) || "gen-lang-client-0552105030.firebasestorage.app",
  messagingSenderId: (import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string) || "505833470714",
  appId: (import.meta.env.VITE_FIREBASE_APP_ID as string) || "1:505833470714:web:5d7e65873ff773da9ca743",
  measurementId: (import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string) || "",
  firestoreDatabaseId: (import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID as string) || "ai-studio-60aca418-babc-48dc-bccd-7043c09a55b8"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Services (Safely use custom Firestore Database ID if specified)
export const db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling Infrastructure
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Callback: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection Validation on startup
export async function validateConnection() {
  try {
    await getDocFromServer(doc(db, 'test-connection-probe', 'connection-id'));
    console.log("Firebase connection operational.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection. Client is offline.");
    } else {
      console.log("Firebase probe returned expected feedback (may be permission-denied catch, which indicates live connection).");
    }
  }
}

// Authenticate helper using PopUp
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Google Sign In Error:", error);
    throw error;
  }
}

// Sign-out helper
export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Sign Out Error:", error);
    throw error;
  }
}
