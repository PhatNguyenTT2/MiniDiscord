"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loader2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useAuthStore } from "@/stores/authStore";

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const registerAction = useAuthStore((state) => state.register);
  const isLoading = useAuthStore((state) => state.isLoading);
  const error = useAuthStore((state) => state.error);

  const registerSchema = z
    .object({
      username: z
        .string()
        .min(3, t("validation.usernameMin"))
        .max(50, t("validation.usernameMax")),
      email: z.string().email(t("validation.emailInvalid")),
      password: z.string().min(6, t("validation.passwordMin")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("validation.passwordMismatch"),
      path: ["confirmPassword"],
    });

  type RegisterFormData = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  async function onSubmit(data: RegisterFormData) {
    await registerAction({
      username: data.username,
      email: data.email,
      password: data.password,
    });

    // Check if auth was successful by checking the store state
    // Note: In Zustand, the state is updated synchronously after await
    const { isAuthenticated, error } = useAuthStore.getState();

    if (isAuthenticated && !error) {
      router.push("/channels/me");
    }
  }

  return (
    <div className="w-full rounded-lg bg-background p-8 shadow-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-[26px] font-bold leading-tight text-foreground">
          {t("auth.createAccount")}
        </h1>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-3 text-sm text-destructive border border-destructive/30">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="reg-username"
            className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("auth.username")} <span className="text-destructive">*</span>
          </label>
          <Input
            id="reg-username"
            type="text"
            placeholder="username"
            className="h-11"
            {...register("username")}
            aria-invalid={!!errors.username}
          />
          {errors.username && (
            <p className="text-xs text-destructive">
              {errors.username.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reg-email"
            className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("auth.email")} <span className="text-destructive">*</span>
          </label>
          <Input
            id="reg-email"
            type="email"
            placeholder="name@example.com"
            className="h-11"
            {...register("email")}
            aria-invalid={!!errors.email}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reg-password"
            className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("auth.password")} <span className="text-destructive">*</span>
          </label>
          <Input
            id="reg-password"
            type="password"
            placeholder="••••••••"
            className="h-11"
            {...register("password")}
            aria-invalid={!!errors.password}
          />
          {errors.password && (
            <p className="text-xs text-destructive">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="reg-confirm"
            className="block text-xs font-bold uppercase tracking-wide text-muted-foreground"
          >
            {t("auth.confirmPassword")}{" "}
            <span className="text-destructive">*</span>
          </label>
          <Input
            id="reg-confirm"
            type="password"
            placeholder="••••••••"
            className="h-11"
            {...register("confirmPassword")}
            aria-invalid={!!errors.confirmPassword}
          />
          {errors.confirmPassword && (
            <p className="text-xs text-destructive">
              {errors.confirmPassword.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          className="h-11 w-full text-base font-medium"
          disabled={isLoading}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("auth.signUp")}
        </Button>

        <p className="text-sm text-muted-foreground">
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-accent hover:underline"
          >
            {t("auth.login")}
          </Link>
        </p>
      </form>
    </div>
  );
}
