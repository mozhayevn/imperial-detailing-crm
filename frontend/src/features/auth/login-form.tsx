"use client";

import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useAuth } from "@/src/features/auth/use-auth";
import { getApiErrorMessage } from "@/src/lib/api/errors";
import { resendTwoFactorCode } from "@/src/features/auth/api";

export function LoginForm() {
  const { login, verifyTwoFactor, isLoading } = useAuth();

  const [authStep, setAuthStep] = useState<"credentials" | "two_factor">(
    "credentials",
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [twoFactorChallengeId, setTwoFactorChallengeId] = useState<
    number | null
  >(null);
  const [twoFactorDestination, setTwoFactorDestination] = useState<
    string | null
  >(null);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [isVerifyingTwoFactor, setIsVerifyingTwoFactor] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(45);
  const [isResendingCode, setIsResendingCode] = useState(false);

  const [hasTwoFactorCodeError, setHasTwoFactorCodeError] = useState(false);
  const [isTwoFactorShaking, setIsTwoFactorShaking] = useState(false);
  const [twoFactorErrorAnimationKey, setTwoFactorErrorAnimationKey] =
    useState(0);

  const [error, setError] = useState<string | null>(null);

  const isTwoFactorStep = authStep === "two_factor";

  useEffect(() => {
    if (!twoFactorChallengeId || resendSecondsLeft <= 0) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setResendSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timerId);
  }, [twoFactorChallengeId, resendSecondsLeft]);

  function resetTwoFactorStep() {
    setAuthStep("credentials");
    setTwoFactorChallengeId(null);
    setTwoFactorDestination(null);
    setTwoFactorCode("");
    setResendSecondsLeft(45);
    setHasTwoFactorCodeError(false);
    setIsTwoFactorShaking(false);
    setTwoFactorErrorAnimationKey(0);
    setIsVerifyingTwoFactor(false);
    setIsResendingCode(false);
    setError(null);
  }

  function updateTwoFactorDigit(index: number, value: string) {
    setHasTwoFactorCodeError(false);
    setIsTwoFactorShaking(false);

    const digit = value.replace(/\D/g, "").slice(-1);
    const currentDigits = twoFactorCode.padEnd(6, " ").split("");

    currentDigits[index] = digit || " ";

    const nextCode = currentDigits.join("").replace(/\s/g, "");

    setTwoFactorCode(nextCode);

    if (digit && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handleTwoFactorKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace") {
      event.preventDefault();

      setHasTwoFactorCodeError(false);
      setIsTwoFactorShaking(false);

      const currentDigits = twoFactorCode.padEnd(6, " ").split("");

      if (!currentDigits[index]?.trim() && index > 0) {
        codeInputRefs.current[index - 1]?.focus();
        currentDigits[index - 1] = " ";
      } else {
        currentDigits[index] = " ";
      }

      setTwoFactorCode(currentDigits.join("").replace(/\s/g, ""));
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }

    if (event.key === "ArrowRight" && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  }

  function handleTwoFactorPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();

    setHasTwoFactorCodeError(false);
    setIsTwoFactorShaking(false);

    const pastedCode = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pastedCode) {
      return;
    }

    setTwoFactorCode(pastedCode);

    const nextFocusIndex = Math.min(pastedCode.length, 5);
    codeInputRefs.current[nextFocusIndex]?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const result = await login({
        email,
        password,
      });

      if (result.requires_2fa === true) {
        const challengeId = Number(result.challenge_id);

        if (!challengeId) {
          setError("Backend не вернул challenge_id для 2FA.");
          return;
        }

        setTwoFactorChallengeId(challengeId);
        setTwoFactorDestination(result.destination_masked ?? null);
        setTwoFactorCode("");
        setHasTwoFactorCodeError(false);
        setIsTwoFactorShaking(false);
        setTwoFactorErrorAnimationKey(0);
        setResendSecondsLeft(45);
        setAuthStep("two_factor");
        return;
      }
    } catch (loginError) {
      setError(getApiErrorMessage(loginError));
    }
  }

  async function handleResendTwoFactorCode() {
    if (!twoFactorChallengeId) {
      setError("Сначала выполните вход по email и паролю.");
      return;
    }

    setIsResendingCode(true);
    setError(null);

    try {
      const result = await resendTwoFactorCode({
        challenge_id: twoFactorChallengeId,
      });

      setTwoFactorChallengeId(result.challenge_id);
      setTwoFactorDestination(result.destination_masked ?? null);
      setTwoFactorCode("");
      setHasTwoFactorCodeError(false);
      setIsTwoFactorShaking(false);
      setTwoFactorErrorAnimationKey(0);
      setResendSecondsLeft(45);
      setAuthStep("two_factor");

      window.setTimeout(() => {
        codeInputRefs.current[0]?.focus();
      }, 0);
    } catch (resendError) {
      setError(getApiErrorMessage(resendError));
    } finally {
      setIsResendingCode(false);
    }
  }

  async function handleVerifyTwoFactor(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!twoFactorChallengeId) {
      setError("Сначала выполните вход по email и паролю.");
      return;
    }

    const code = twoFactorCode.trim();

    if (!code || code.length !== 6) {
      setError("Введите 6-значный код подтверждения.");
      return;
    }

    setIsVerifyingTwoFactor(true);
    setError(null);

    try {
      await verifyTwoFactor({
        challenge_id: twoFactorChallengeId,
        code,
      });
    } catch (verifyError) {
      setError(getApiErrorMessage(verifyError));
      setHasTwoFactorCodeError(true);
      setIsTwoFactorShaking(true);
      setTwoFactorErrorAnimationKey((current) => current + 1);

      window.setTimeout(() => {
        setIsTwoFactorShaking(false);
        setTwoFactorCode("");
        codeInputRefs.current[0]?.focus();
      }, 450);
    } finally {
      setIsVerifyingTwoFactor(false);
    }
  }

  useEffect(() => {
    if (!isTwoFactorStep) {
      return;
    }

    if (twoFactorCode.length !== 6) {
      return;
    }

    if (isVerifyingTwoFactor) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void handleVerifyTwoFactor();
    }, 350);

    return () => window.clearTimeout(timerId);

    // handleVerifyTwoFactor intentionally excluded:
    // this effect should run only when the code becomes complete.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTwoFactorStep, twoFactorCode, isVerifyingTwoFactor]);

  if (isTwoFactorStep) {
    const codeDigits = twoFactorCode.padEnd(6, " ").split("").slice(0, 6);

    return (
      <form onSubmit={handleVerifyTwoFactor} className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <Badge tone="primary">2FA verification</Badge>
          <span className="text-xs text-[hsl(var(--muted))]">Email code</span>
        </div>

        <div className="rounded-3xl border border-[rgb(45_212_191_/_0.22)] bg-[linear-gradient(135deg,rgb(45_212_191_/_0.10),rgb(15_23_42_/_0.45))] p-5 text-center shadow-lg shadow-black/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-[rgb(45_212_191_/_0.25)] bg-[rgb(45_212_191_/_0.14)] text-2xl font-black text-[rgb(94_234_212)] shadow-lg shadow-[rgb(45_212_191_/_0.12)]">
            ✓
          </div>

          <div className="mt-4 text-lg font-semibold text-white">
            Код подтверждения
          </div>

          <div className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[hsl(var(--muted))]">
            Введите 6-значный код, отправленный на{" "}
            <span className="font-semibold text-[hsl(var(--muted-foreground))]">
              {twoFactorDestination ?? "ваш email"}
            </span>
            .
          </div>

          <div
            key={twoFactorErrorAnimationKey}
            className={[
              "mt-5 grid grid-cols-6 gap-2",
              isTwoFactorShaking ? "animate-code-shake" : "",
            ].join(" ")}
          >
            {codeDigits.map((digit, index) => {
              const isFilled = Boolean(digit.trim());
              const isActive = twoFactorCode.length === index;

              return (
                <input
                  key={index}
                  ref={(element) => {
                    codeInputRefs.current[index] = element;
                  }}
                  value={digit.trim()}
                  inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  maxLength={1}
                  onChange={(event) =>
                    updateTwoFactorDigit(index, event.target.value)
                  }
                  onKeyDown={(event) => handleTwoFactorKeyDown(index, event)}
                  onPaste={handleTwoFactorPaste}
                  className={[
                    "h-14 rounded-2xl border bg-[hsl(var(--surface-1))] text-center text-xl font-semibold text-white outline-none transition-all duration-200",
                    "focus:-translate-y-0.5 focus:scale-[1.03] focus:border-[rgb(45_212_191_/_0.65)] focus:bg-[rgb(45_212_191_/_0.08)] focus:shadow-lg focus:shadow-[rgb(45_212_191_/_0.12)]",
                    hasTwoFactorCodeError
                      ? "border-[rgb(248_113_113_/_0.75)] bg-[rgb(248_113_113_/_0.10)] text-[rgb(254_202_202)] shadow-lg shadow-[rgb(248_113_113_/_0.12)]"
                      : isFilled
                        ? "border-[rgb(45_212_191_/_0.45)] bg-[rgb(45_212_191_/_0.08)]"
                        : "border-[hsl(var(--border))]",
                    isActive && !hasTwoFactorCodeError
                      ? "ring-2 ring-[rgb(45_212_191_/_0.18)]"
                      : "",
                    hasTwoFactorCodeError
                      ? "ring-2 ring-[rgb(248_113_113_/_0.20)]"
                      : "",
                  ].join(" ")}
                />
              );
            })}
          </div>

          <div className="mt-3 text-[11px] leading-5 text-[hsl(var(--muted))]">
            После ввода 6 цифр проверка начнется автоматически.
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <div className="text-[11px] text-[hsl(var(--muted))]">
              Код не пришел?
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={
                resendSecondsLeft > 0 || isResendingCode || isVerifyingTwoFactor
              }
              onClick={() => void handleResendTwoFactorCode()}
            >
              {isResendingCode
                ? "Отправляем..."
                : resendSecondsLeft > 0
                  ? `Отправить повторно через ${resendSecondsLeft} сек.`
                  : "Отправить код повторно"}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.1)] px-4 py-3 text-sm leading-6 text-[rgb(252_165_165)]">
            {error}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-12 w-full"
          disabled={isVerifyingTwoFactor || twoFactorCode.length !== 6}
        >
          {isVerifyingTwoFactor ? "Проверяем..." : "Подтвердить вход"}
        </Button>

        <button
          type="button"
          disabled={isVerifyingTwoFactor}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            resetTwoFactorStep();
          }}
          className="h-12 w-full rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-4 text-sm font-semibold text-[hsl(var(--muted-foreground))] transition hover:border-[hsl(var(--border-strong))] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          Вернуться к email и паролю
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Badge tone="primary">Secure access</Badge>
        <span className="text-xs text-[hsl(var(--muted))]">
          HttpOnly cookie auth
        </span>
      </div>

      <Input
        label="Email"
        name="email"
        type="email"
        placeholder="admin@imperial.kz"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />

      <Input
        label="Пароль"
        name="password"
        type="password"
        placeholder="Введите пароль"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />

      {error ? (
        <div className="rounded-2xl border border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.1)] px-4 py-3 text-sm leading-6 text-[rgb(252_165_165)]">
          {error}
        </div>
      ) : null}

      <Button type="submit" className="h-12 w-full" disabled={isLoading}>
        {isLoading ? "Входим..." : "Войти в CRM"}
      </Button>
    </form>
  );
}