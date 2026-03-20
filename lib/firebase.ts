import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import {
  Timestamp,
  query,
  orderBy,
  getDocs,
  deleteDoc,
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

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  amount: number;
  category: string;
  merchant: string;
  type: TransactionType;
  status: "completed" | "pending" | "failed";
  account: string;
  createdAt: Timestamp | null;
};

export type WorkspaceRecord = {
  id: string;
  title: string;
  description: string;
  amount: number;
  status: string;
  createdAt: Timestamp | null;
};

export type UserNotificationPriority = "low" | "medium" | "high";

export type UserNotification = {
  id: string;
  title: string;
  message: string;
  taskType: string;
  priority: UserNotificationPriority;
  isRead: boolean;
  createdAt: Timestamp | null;
};

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

export async function createUserNotification(
  uid: string,
  payload: {
    title: string;
    message: string;
    taskType?: string;
    priority?: UserNotificationPriority;
  },
) {
  try {
    const db = getFirestore(getFirebaseApp());
    await addDoc(collection(db, "users", uid, "notifications"), {
      title: payload.title,
      message: payload.message,
      taskType: payload.taskType ?? "general",
      priority: payload.priority ?? "low",
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
}

export async function getUserNotifications(uid: string): Promise<UserNotification[]> {
  try {
    const db = getFirestore(getFirebaseApp());
    const notificationsRef = collection(db, "users", uid, "notifications");
    const notificationsQuery = query(notificationsRef, orderBy("createdAt", "desc"));
    const notificationsSnap = await getDocs(notificationsQuery);

    return notificationsSnap.docs.map((notificationDoc) => {
      const data = notificationDoc.data();

      const priority =
        data.priority === "high" || data.priority === "medium" ? data.priority : "low";

      return {
        id: notificationDoc.id,
        title: String(data.title ?? "Notification"),
        message: String(data.message ?? ""),
        taskType: String(data.taskType ?? "general"),
        priority,
        isRead: Boolean(data.isRead ?? false),
        createdAt: (data.createdAt as Timestamp | undefined) ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    throw error;
  }
}

export async function markNotificationAsRead(uid: string, notificationId: string) {
  try {
    const db = getFirestore(getFirebaseApp());
    const notificationRef = doc(db, "users", uid, "notifications", notificationId);
    await setDoc(
      notificationRef,
      {
        isRead: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(uid: string) {
  try {
    const db = getFirestore(getFirebaseApp());
    const notificationsRef = collection(db, "users", uid, "notifications");
    const notificationsSnap = await getDocs(notificationsRef);

    await Promise.all(
      notificationsSnap.docs.map((notificationDoc) =>
        setDoc(
          notificationDoc.ref,
          {
            isRead: true,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        ),
      ),
    );
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
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

export async function createTransaction(
  uid: string,
  payload: {
    amount: number;
    category: string;
    merchant: string;
    type: TransactionType;
    account?: string;
    status?: "completed" | "pending" | "failed";
  },
) {
  try {
    const db = getFirestore(getFirebaseApp());
    await addDoc(collection(db, "users", uid, "transactions"), {
      ...payload,
      account: payload.account ?? "Main Wallet",
      status: payload.status ?? "completed",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating transaction:", error);
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
    await createUserNotification(userCredential.user.uid, {
      title: "Account Created",
      message: "Your account was created successfully.",
      taskType: "auth",
      priority: "high",
    });
    return userCredential.user;
  } catch (error) {
    console.error("Error signing up:", error);
    throw error;
  }
}

export async function _SignInWithEmailAndPassword(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error signing in:", error);
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

      await createUserNotification(user.uid, {
        title: "Welcome",
        message: "Your Google account is connected and ready.",
        taskType: "auth",
        priority: "high",
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

export async function getTransactionsByUid(uid: string): Promise<Transaction[]> {
  try {
    const db = getFirestore(getFirebaseApp());
    const transactionsRef = collection(db, "users", uid, "transactions");
    const transactionsQuery = query(transactionsRef, orderBy("createdAt", "desc"));
    const transactionsSnap = await getDocs(transactionsQuery);

    return transactionsSnap.docs.map((transactionDoc) => {
      const data = transactionDoc.data();
      return {
        id: transactionDoc.id,
        amount: Number(data.amount ?? 0),
        category: String(data.category ?? "Uncategorized"),
        merchant: String(data.merchant ?? "Unknown"),
        type: data.type === "expense" ? "expense" : "income",
        status:
          data.status === "pending" || data.status === "failed" ? data.status : "completed",
        account: String(data.account ?? "Main Wallet"),
        createdAt: (data.createdAt as Timestamp | undefined) ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
}

export async function deleteTransactionById(uid: string, transactionId: string) {
  try {
    const db = getFirestore(getFirebaseApp());
    const transactionRef = doc(db, "users", uid, "transactions", transactionId);
    await deleteDoc(transactionRef);
  } catch (error) {
    console.error("Error deleting transaction:", error);
    throw error;
  }
}

export async function createWorkspaceRecord(
  uid: string,
  collectionName: string,
  payload: {
    title: string;
    description?: string;
    amount?: number;
    status?: string;
  },
) {
  try {
    const db = getFirestore(getFirebaseApp());
    await addDoc(collection(db, "users", uid, collectionName), {
      title: payload.title,
      description: payload.description ?? "",
      amount: payload.amount ?? 0,
      status: payload.status ?? "active",
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Error creating workspace record:", error);
    throw error;
  }
}

export async function getWorkspaceRecordsByUid(
  uid: string,
  collectionName: string,
): Promise<WorkspaceRecord[]> {
  try {
    const db = getFirestore(getFirebaseApp());
    const recordsRef = collection(db, "users", uid, collectionName);
    const recordsQuery = query(recordsRef, orderBy("createdAt", "desc"));
    const recordsSnap = await getDocs(recordsQuery);

    return recordsSnap.docs.map((recordDoc) => {
      const data = recordDoc.data();

      return {
        id: recordDoc.id,
        title: String(data.title ?? "Untitled"),
        description: String(data.description ?? ""),
        amount: Number(data.amount ?? 0),
        status: String(data.status ?? "active"),
        createdAt: (data.createdAt as Timestamp | undefined) ?? null,
      };
    });
  } catch (error) {
    console.error("Error fetching workspace records:", error);
    throw error;
  }
}

export async function deleteWorkspaceRecordById(
  uid: string,
  collectionName: string,
  recordId: string,
) {
  try {
    const db = getFirestore(getFirebaseApp());
    const recordRef = doc(db, "users", uid, collectionName, recordId);
    await deleteDoc(recordRef);
  } catch (error) {
    console.error("Error deleting workspace record:", error);
    throw error;
  }
}

export async function updateWorkspaceRecordById(
  uid: string,
  collectionName: string,
  recordId: string,
  payload: {
    title?: string;
    description?: string;
    amount?: number;
    status?: string;
  },
) {
  try {
    const db = getFirestore(getFirebaseApp());
    const recordRef = doc(db, "users", uid, collectionName, recordId);
    await setDoc(
      recordRef,
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error updating workspace record:", error);
    throw error;
  }
}

export async function updateUserProfile(
  uid: string,
  payload: {
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
  },
) {
  try {
    const db = getFirestore(getFirebaseApp());
    const userRef = doc(db, "users", uid);
    await setDoc(
      userRef,
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error updating user profile:", error);
    throw error;
  }
}

export async function updateUserSettings(
  uid: string,
  payload: {
    currency?: string;
    language?: string;
    emailNotifications?: boolean;
  },
) {
  try {
    const db = getFirestore(getFirebaseApp());
    const settingsRef = doc(db, "users", uid, "meta", "settings");
    await setDoc(
      settingsRef,
      {
        ...payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.error("Error updating user settings:", error);
    throw error;
  }
}

export async function getUserSettings(uid: string) {
  try {
    const db = getFirestore(getFirebaseApp());
    const settingsRef = doc(db, "users", uid, "meta", "settings");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return {
        currency: "USD",
        language: "en",
        emailNotifications: true,
      };
    }

    const data = settingsSnap.data();
    return {
      currency: String(data.currency ?? "USD"),
      language: String(data.language ?? "en"),
      emailNotifications: Boolean(data.emailNotifications ?? true),
    };
  } catch (error) {
    console.error("Error fetching user settings:", error);
    throw error;
  }
}
