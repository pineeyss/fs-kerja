import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import PasswordField from "@/components/ui/PasswordField";
import { LoadingState } from "@/components/common/states";
import AuthShell from "./AuthShell";
import PasswordStrength from "./PasswordStrength";
import { passwordSchema } from "./passwordRules";
import * as authApi from "@/services/api/auth.api";
import { getErrorMessage } from "@/services/api/client";

const schema = z
  .object({
    password: passwordSchema,
    confirm: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Konfirmasi password tidak sama" });

function InvalidLink({ message }) {
  return (
    <AuthShell title="Tautan tidak dapat dipakai" subtitle={message}>
      <p className="mb-5 text-center text-sm">Minta Owner mengirim ulang tautan aktivasi ke email Anda.</p>
      <Link to="/login" className="block">
        <Button className="h-12 w-full rounded-xl">Ke halaman login</Button>
      </Link>
    </AuthShell>
  );
}

export default function ActivationPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const navigate = useNavigate();
  const [formError, setFormError] = useState("");

  // Validasi token + ambil nama/email pemilik akun
  const info = useQuery({
    queryKey: ["activation", token],
    queryFn: () => authApi.getActivation(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  const password = useWatch({ control, name: "password" }) ?? "";

  if (!token) return <InvalidLink message="Tautan aktivasi tidak lengkap." />;
  if (info.isLoading)
    return (
      <AuthShell title="Aktivasi Akun Anda">
        <LoadingState label="Memeriksa tautan aktivasi…" />
      </AuthShell>
    );
  if (info.isError) return <InvalidLink message={getErrorMessage(info.error, "Tautan aktivasi tidak valid atau sudah kedaluwarsa.")} />;

  const onSubmit = async ({ password }) => {
    setFormError("");
    try {
      await authApi.activate({ token, password });
      toast.success("Akun berhasil diaktifkan. Silakan login.");
      navigate("/login", { replace: true });
    } catch (err) {
      setFormError(getErrorMessage(err, "Aktivasi gagal. Coba lagi."));
    }
  };

  const { name, email } = info.data;

  return (
    <AuthShell
      title="Aktivasi Akun Anda"
      subtitle={`Halo ${name}, buat password baru untuk mulai menggunakan AkutuStocks.`}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        <p className="rounded-lg bg-surface/70 px-3 py-2 text-center text-[13px]">
          Akun: <span className="font-semibold">{email}</span>
        </p>
        {formError && (
          <div role="alert" className="rounded-lg border border-danger bg-surface px-3 py-2.5 text-sm font-medium text-danger-ink">
            {formError}
          </div>
        )}
        <PasswordField
          label="Password Baru"
          autoComplete="new-password"
          placeholder="Password"
          inputClassName="h-14 rounded-xl text-base"
          error={errors.password?.message}
          {...register("password")}
        />

        <PasswordStrength password={password} />

        <PasswordField
          label="Konfirmasi Password"
          autoComplete="new-password"
          placeholder="Password"
          inputClassName="h-14 rounded-xl text-base"
          error={errors.confirm?.message}
          {...register("confirm")}
        />

        <Button type="submit" loading={isSubmitting} className="mt-2 h-12 w-full rounded-xl text-[15px]">
          {isSubmitting ? "Memproses…" : "Aktifkan Akun"}
        </Button>
      </form>
    </AuthShell>
  );
}
