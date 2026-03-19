"use client";

import React from "react";
import { Apple, ArrowRight, Check, Chrome, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { _CreateUserWithEmailAndPassword, _SignInWithGoogle, auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";

const heroSlides = [
  "Capturing Moments, Creating Memories",
  "Design Better Workflows With Confidence",
  "Build Fast, Scale Faster",
];

const Page = () => {
  const [mode, setMode] = React.useState<"register" | "login">("register");
  const [firstName, setFirstName] = React.useState("Fletcher");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [acceptedTerms, setAcceptedTerms] = React.useState(true);
  const [showPassword, setShowPassword] = React.useState(false);
  const [activeSlide, setActiveSlide] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
    }, 3500);

    

    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/dashboard");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    
    // Validation
    if (!email) {
      toast.error("Email is required");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (mode === "register" && !acceptedTerms) {
      toast.error("Please accept the terms & conditions");
      return;
    }
    if (mode === "register" && !firstName.trim()) {
      toast.error("First name is required");
      return;
    }

    setIsLoading(true);

    const loadingToast = toast.loading(
      mode === "register" ? "Creating your account..." : "Logging you in...",
    );
    
    _CreateUserWithEmailAndPassword(email, `${firstName} ${lastName}`, password)
      .then((user) => {
        toast.dismiss(loadingToast);
        toast.success(
          mode === "register"
            ? `Welcome, ${user.displayName || firstName}! Account created.`
            : "Logged in successfully!",
        );
        console.log("User created:", user);
        // TODO: Redirect to dashboard after successful auth
      })
      .catch((error) => {
        toast.dismiss(loadingToast);
        
        // Extract error message
        let errorMessage = "An error occurred. Please try again.";
        if (error.code === "auth/email-already-in-use") {
          errorMessage = "This email is already in use.";
        } else if (error.code === "auth/invalid-email") {
          errorMessage = "Invalid email address.";
        } else if (error.code === "auth/weak-password") {
          errorMessage = "Password is too weak. Use at least 6 characters.";
        } else if (error.code === "auth/user-not-found") {
          errorMessage = "User not found. Please check your email.";
        } else if (error.code === "auth/wrong-password") {
          errorMessage = "Incorrect password.";
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        toast.error(errorMessage);
        console.error("Auth error:", error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleGoogleAuth = async () => {
    const loadingToast = toast.loading("Signing in with Google...");

    try {
      await _SignInWithGoogle();
      toast.dismiss(loadingToast);
      toast.success("Signed in with Google successfully.");
      router.push("/dashboard");
    } catch (error: any) {
      toast.dismiss(loadingToast);

      if (error?.code === "auth/popup-closed-by-user") {
        toast.error("Google sign-in was cancelled.");
        return;
      }

      toast.error("Google sign-in failed. Please try again.");
      console.error("Google auth error:", error);
    }
  };

  return (
    <main className="min-h-screen bg-forground p-4 md:p-6 lg:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl grid-cols-1 rounded-3xl bg-forground p-3  md:min-h-[calc(100vh-3rem)] md:grid-cols-[1.1fr_1fr] md:gap-4 md:p-4 lg:min-h-[calc(100vh-4rem)]">
        <section className="relative hidden overflow-hidden rounded-2xl md:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(255,255,255,0.58)_0%,rgba(255,255,255,0)_34%),radial-gradient(circle_at_12%_86%,rgba(254,87,143,0.30)_0%,rgba(254,87,143,0)_42%),radial-gradient(circle_at_84%_12%,rgba(132,104,255,0.45)_0%,rgba(132,104,255,0)_40%),linear-gradient(140deg,#f4ebdf_0%,#e8cde1_44%,#b7a4f2_74%,#a2caef_100%)]" />

          <div className="absolute left-6 right-6 top-6 flex items-center justify-between">
            <div className="rounded-lg bg-black/30 px-3 py-1 text-sm font-semibold tracking-[0.25em] text-white backdrop-blur-sm">
              AMU
            </div>
            <button className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-sm text-white backdrop-blur-sm transition hover:bg-white/30">
              Back to website
              <ArrowRight size={15} />
            </button>
          </div>

          <div className="absolute inset-x-8 bottom-8 text-white">
            <p className="max-w-xs text-4xl font-semibold leading-tight tracking-tight">
              {heroSlides[activeSlide]}
            </p>

            <div className="mt-6 flex gap-2">
              {heroSlides.map((_, index) => (
                <button
                  aria-label={`Go to slide ${index + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === activeSlide ? "w-9 bg-white" : "w-6 bg-white/40 hover:bg-white/70"
                  }`}
                  key={index}
                  onClick={() => setActiveSlide(index)}
                  type="button"
                />
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-2xl px-3 py-8 md:px-8">
          <div className="w-full max-w-xl">
            <h1 className="text-4xl font-semibold tracking-tight text-text md:text-5xl">
              {mode === "register" ? "Create an account" : "Welcome back"}
            </h1>
            <p className="mt-3 text-base text-text-secondary">
              {mode === "register" ? "Already have an account? " : "Don\'t have an account? "}
              <button
                className="font-semibold text-text underline"
                onClick={() => setMode((prev) => (prev === "register" ? "login" : "register"))}
                type="button"
              >
                {mode === "register" ? "Log in" : "Create account"}
              </button>
            </p>

            <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    className="h-12 rounded-xl border border-outline bg-secondary px-4 text-text outline-none transition focus:border-hover"
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="First name"
                    value={firstName}
                  />
                  <input
                    className="h-12 rounded-xl border border-outline bg-secondary px-4 text-text outline-none transition focus:border-hover"
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Last name"
                    value={lastName}
                  />
                </div>
              )}

              <input
                className="h-12 w-full rounded-xl border border-outline bg-secondary px-4 text-text outline-none transition focus:border-hover"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email"
                type="email"
                value={email}
              />

              <div className="relative">
                <input
                  className="h-12 w-full rounded-xl border border-outline bg-secondary px-4 pr-11 text-text outline-none transition focus:border-hover"
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={mode === "register" ? "Enter your password" : "Password"}
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary transition hover:text-text"
                  onClick={() => setShowPassword((prev) => !prev)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {mode === "register" ? (
                <label className="flex cursor-pointer items-center gap-3 text-sm text-text">
                  <button
                    aria-label="Accept terms"
                    className={`grid h-5 w-5 place-items-center rounded border ${
                      acceptedTerms
                        ? "border-text bg-text text-forground"
                        : "border-outline bg-forground text-forground"
                    }`}
                    onClick={() => setAcceptedTerms((prev) => !prev)}
                    type="button"
                  >
                    {acceptedTerms && <Check size={13} />}
                  </button>
                  <span>
                    I agree to the{" "}
                    <a className="underline" href="#">
                      Terms &amp; Conditions
                    </a>
                  </span>
                </label>
              ) : (
                <div className="text-right text-sm">
                  <button className="text-text-secondary underline hover:text-text" type="button">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                className="h-12 w-full rounded-xl bg-text text-base font-medium text-forground transition hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={isLoading}
              >
                {isLoading
                  ? mode === "register"
                    ? "Creating account..."
                    : "Logging in..."
                  : mode === "register"
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-outline" />
              <span className="text-sm text-text-secondary">
                {mode === "register" ? "Or register with" : "Or continue with"}
              </span>
              <div className="h-px flex-1 bg-outline" />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-outline bg-forground text-text transition hover:bg-secondary"
                onClick={handleGoogleAuth}
                type="button"
              >
                <Chrome size={18} />
                Google
              </button>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-outline bg-secondary text-text-secondary cursor-not-allowed"
                disabled
                type="button"
              >
                <Apple size={18} />
                Apple (Soon)
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default Page;