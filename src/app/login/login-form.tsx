"use client";
import { useActionState, useState } from "react";
import { login } from "@/features/auth/actions";
export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState(login, { error: "" });
  return (
    <form action={action} className="auth-form">
      <label htmlFor="email">ایمیل</label>
      <input
        id="email"
        name="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        type="email"
        dir="ltr"
        autoComplete="username"
        maxLength={254}
        required
      />
      <label htmlFor="password">گذرواژه</label>
      <input
        id="password"
        name="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        type={showPassword ? "text" : "password"}
        dir="ltr"
        autoComplete="current-password"
        maxLength={128}
        required
      />
      <button
        type="button"
        className="password-toggle"
        aria-controls="password"
        aria-pressed={showPassword}
        onClick={() => setShowPassword(!showPassword)}
      >
        {showPassword ? "پنهان‌کردن گذرواژه" : "نمایش گذرواژه"}
      </button>
      <p role="status" aria-live="polite">
        {state.error}
      </p>
      <button className="button" disabled={pending} type="submit">
        {pending ? "در حال ورود…" : "ورود به میزفلو"}
      </button>
    </form>
  );
}
