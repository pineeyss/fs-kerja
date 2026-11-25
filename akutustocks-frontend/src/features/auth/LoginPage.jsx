import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import PasswordField from "@/components/ui/PasswordField";
import AuthShell from "./AuthShell";
import { useAuth } from "./AuthContext";
import { getErrorMessage, USE_MOCK } from "@/services/api/client";
import { SAMPLE_USERS } from "@/services/api/mock/users";

const schema = z.object({
  email: z.string().min(1, "Email wajib diisi").email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });

  if (user) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values) => {
    setFormError("");
    try {
      await login(values);
      navigate(location.state?.from ?? "/dashboard", { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, "Login gagal. Coba lagi."));
    }
  };

  return (
    <AuthShell
      title="Login AkutuStocks"
      subtitle="Selamat Datang Kembali"
      footer={
        USE_MOCK && (
          <>
            <p className="font-medium text-ink">Mode data contoh (kata sandi: contoh123)</p>
            <p>{SAMPLE_USERS.map((u) => u.email).join(" · ")}</p>
          </>
        )
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-danger bg-surface px-3 py-2.5 text-sm font-medium text-danger-ink">
            {formError}
          </div>
        )}
        <FormField
          label="Email"
          type="email"
          autoComplete="username"
          placeholder="Email"
          inputClassName="h-14 rounded-xl text-base"
          error={errors.email?.message}
          {...register("email")}
        />
        <div>
          <PasswordField
            label="Password"
            autoComplete="current-password"
            placeholder="Password"
            inputClassName="h-14 rounded-xl text-base"
            error={errors.password?.message}
            {...register("password")}
          />
          <p className="mt-2 text-right text-[13px]">Lupa password? Hubungi Owner.</p>
        </div>
        <Button type="submit" loading={isSubmitting} className="h-12 w-full rounded-xl text-[15px]">
          {isSubmitting ? "Memproses…" : "Login"}
        </Button>
      </form>
    </AuthShell>
  );
}
