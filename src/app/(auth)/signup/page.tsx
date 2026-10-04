"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { signUp, type AuthState } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function SignupPage() {
  const [state, action, pending] = useActionState<AuthState, FormData>(
    signUp,
    undefined
  );
  const [showPassword, setShowPassword] = useState(false);

  // Email confirmation required — show a success screen instead of form
  if (state?.message === "check-email") {
    return (
      <Card className="w-full max-w-md shadow-2xl border-border/60">
        <CardHeader className="space-y-1 pb-4 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <MailCheck className="w-7 h-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
          <CardDescription>
            We sent a confirmation link to your email address. Click it to
            activate your account, then come back and sign in.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center pt-2">
          <Button asChild variant="outline">
            <Link href="/login">Go to Sign In</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl border-border/60">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Start building AI chatbots from your documents
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={action} className="space-y-5">
          {/* Global error message (non check-email) */}
          {state?.message && state.message !== "check-email" && (
            <div
              role="alert"
              className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3"
            >
              {state.message}
            </div>
          )}

          {/* Full Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="Shiv Yadav"
              autoComplete="name"
              aria-describedby="name-error"
              disabled={pending}
            />
            {state?.errors?.name && (
              <p id="name-error" className="text-xs text-destructive">
                {state.errors.name[0]}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              aria-describedby="email-error"
              disabled={pending}
            />
            {state?.errors?.email && (
              <p id="email-error" className="text-xs text-destructive">
                {state.errors.email[0]}
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                aria-describedby="password-error"
                disabled={pending}
                className="pr-10"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {state?.errors?.password && (
              <p id="password-error" className="text-xs text-destructive">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account…
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </form>
      </CardContent>

      <CardFooter className="pt-0 flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-primary font-medium hover:underline"
          >
            Sign In
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
