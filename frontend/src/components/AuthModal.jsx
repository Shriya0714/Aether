
import { useState } from "react";
import {
  Activity,
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  UserRound,
  X,
} from "lucide-react";
import "./AuthModal.css";

export default function AuthModal({
  onClose,
  onAuthenticated,
  onSignIn,
  onSignUp,
}) {
  const [mode, setMode] = useState("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === "signup";

  function switchMode(nextMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    if (isSignUp && !username.trim()) {
      setError("Please enter a username.");
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (isSignUp && password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }

    const submitAction = isSignUp ? onSignUp : onSignIn;

    if (typeof submitAction !== "function") {
      setError(
        "Authentication is not connected to the server yet."
      );
      return;
    }

    setLoading(true);

    try {
      const result = await submitAction(
        isSignUp
          ? {
              username: username.trim(),
              email: email.trim(),
              password,
              confirmPassword,
            }
          : {
              email: email.trim(),
              password,
            }
      );

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.user) {
        onAuthenticated?.(result.user);
        onClose?.();
      } else if (result?.success) {
        if (isSignUp) {
          setError(
            "Account created. Please sign in with your new account."
          );
          switchMode("signin");
        } else {
          setError("Sign-in succeeded, but no user profile was returned.");
        }
      } else {
        setError("The server returned an unexpected response.");
      }
    } catch {
      setError(
        "Could not connect to the authentication server. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) {
          onClose?.();
        }
      }}
    >
      <section
        className="auth-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button
          type="button"
          className="auth-close"
          aria-label="Close authentication"
          onClick={onClose}
          disabled={loading}
        >
          <X size={19} />
        </button>

        <div className="auth-brand-mark">
          <Activity size={24} />
        </div>

        <p className="auth-eyebrow">AETHER · NETWORK INTELLIGENCE</p>

        <h2 id="auth-title">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h2>

        <p className="auth-subtitle">
          {isSignUp
            ? "Create an account to access your workspace."
            : "Sign in to continue to your workspace."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignUp && (
            <label className="auth-field">
              <span>Username</span>
              <div className="auth-input-wrap">
                <UserRound size={17} />
                <input
                  type="text"
                  autoComplete="username"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </div>
            </label>
          )}

          <label className="auth-field">
            <span>Email address</span>
            <div className="auth-input-wrap">
              <Mail size={17} />
              <input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <LockKeyhole size={17} />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={
                  isSignUp ? "new-password" : "current-password"
                }
                placeholder={
                  isSignUp ? "At least 8 characters" : "Enter your password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={isSignUp ? 8 : undefined}
              />
              <button
                type="button"
                className="auth-password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {isSignUp && (
            <label className="auth-field">
              <span>Confirm password</span>
              <div className="auth-input-wrap">
                <LockKeyhole size={17} />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((value) => !value)
                  }
                  aria-label={
                    showConfirmPassword
                      ? "Hide confirm password"
                      : "Show confirm password"
                  }
                >
                  {showConfirmPassword
                    ? <EyeOff size={17} />
                    : <Eye size={17} />}
                </button>
              </div>
            </label>
          )}

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "New to Aether?"}{" "}
          <button
            type="button"
            onClick={() =>
              switchMode(isSignUp ? "signin" : "signup")
            }
            disabled={loading}
          >
            {isSignUp ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="auth-security-note">
          Your workspace should only display account data after
          the server verifies your identity.
        </p>
      </section>
    </div>
  );
}
