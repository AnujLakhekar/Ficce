import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { collection, addDoc } from "firebase/firestore";

let cachedApp: FirebaseApp | null = null;

const getFirebaseApp = (): FirebaseApp => {
  if (cachedApp) {
    return cachedApp;
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  cachedApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return cachedApp;
};

export const auth = getAuth(getFirebaseApp());

export async function createUserInFirestore(
  uid: string,
  email: string,
  fullname: string,
) {
  try {
    const db = getFirestore(getFirebaseApp());
    await setDoc(doc(db, "users", uid), {
      email,
      name: fullname,
      role: "user",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating user in Firestore:", error);
    throw error;
  }
}

export async function _HandleTransaction(uid: string) {
  try {
    const db = getFirestore(getFirebaseApp());
    await addDoc(collection(db, "users", uid, "transactions"), {
      amount: 5000,
      type: "income",
      category: "freelance",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error adding transaction:", error);
    throw error;
  }
}

export async function _CreateUserWithEmailAndPassword(
  email: string,
  fullname: string,
  password: string,
) {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    await createUserInFirestore(userCredential.user.uid, email, fullname);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing up:", error);
    throw error;
  }
}

export async function _SignInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;

    const db = getFirestore(getFirebaseApp());
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        name: user.displayName ?? "Google User",
        role: "user",
        provider: "google",
        createdAt: serverTimestamp(),
      });
    }

    return user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

export async function getUserByUid(uid: string) {
  try {
    const db = getFirestore(getFirebaseApp());

    const userRef = doc(db, "users", uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      throw new Error("User not found");
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    throw error;
  }
}
