"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// ─── Schemas ────────────────────────────────────────────────────────────────

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters.").trim(),
  email: z.string().email("Please enter a valid email address.").trim(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .trim(),
});

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address.").trim(),
  password: z.string().min(1, "Password is required."),
});

// ─── Types ───────────────────────────────────────────────────────────────────

export type AuthState =
  | {
      errors?: {
        name?: string[];
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;

// ─── Sign Up ─────────────────────────────────────────────────────────────────

export async function signUp(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const validated = SignupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, email, password } = validated.data;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { errors: { email: ["An account with this email already exists."] } };
    }
    return { message: error.message };
  }

  // If email confirmation is ON in Supabase, session will be null.
  // Show a "check your email" message instead of a broken redirect.
  if (!data.session) {
    return { message: "check-email" };
  }

  redirect("/dashboard");
}

// ─── Login ───────────────────────────────────────────────────────────────────

export async function login(
  state: AuthState,
  formData: FormData
): Promise<AuthState> {
  const validated = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { email, password } = validated.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { message: "Invalid email or password. Please try again." };
  }

  redirect("/dashboard");
}

// ─── Logout ──────────────────────────────────────────────────────────────────

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
