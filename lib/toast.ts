import toast from "react-hot-toast";

/**
 * Show a success toast notification
 */
export const showSuccess = (message: string, duration = 4000) => {
  return toast.success(message, { duration });
};

/**
 * Show an error toast notification
 */
export const showError = (message: string, duration = 4000) => {
  return toast.error(message, { duration });
};

/**
 * Show an info toast notification
 */
export const showInfo = (message: string, duration = 4000) => {
  return toast(message, {
    duration,
    icon: "ℹ️",
  });
};

/**
 * Show a loading toast notification with custom styling
 */
export const showLoading = (message: string) => {
  return toast.loading(message);
};

/**
 * Dismiss a specific toast by its ID
 */
export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

/**
 * Parse Firebase error codes and return user-friendly messages
 */
export const getFirebaseErrorMessage = (
  error: any,
  context: "signup" | "login" = "signup",
): string => {
  const errorCode = error?.code || "";
  const errorMsg = error?.message || "";

  const errorMap: Record<string, string> = {
    "auth/email-already-in-use": "This email is already registered. Try logging in.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/too-many-requests":
      "Too many login attempts. Please try again later.",
    "auth/account-exists-with-different-credential":
      "An account already exists with this email.",
    "auth/operation-not-allowed": "This operation is not allowed. Please contact support.",
    "auth/network-request-failed":
      "Network error. Please check your connection.",
  };

  return errorMap[errorCode] || errorMsg || "An error occurred. Please try again.";
};

/**
 * Show a Firebase error as a toast notification
 */
export const showFirebaseError = (error: any, context: "signup" | "login" = "signup") => {
  const message = getFirebaseErrorMessage(error, context);
  showError(message);
};

/**
 * Show confirmation toast (useful for actions that can be undone)
 */
export const showConfirm = (
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
) => {
  const confirmed = window.confirm(message);
  if (confirmed) {
    onConfirm();
    toast.success("Action confirmed");
    return;
  }

  onCancel?.();
  toast("Action cancelled", { icon: "ℹ️" });
};
