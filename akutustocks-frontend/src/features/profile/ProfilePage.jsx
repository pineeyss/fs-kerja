import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import PageHeader from "@/components/common/PageHeader";
import Button from "@/components/ui/Button";
import PasswordField from "@/components/ui/PasswordField";
import { useAuth } from "@/features/auth/AuthContext";
import PasswordStrength from "@/features/auth/PasswordStrength";
import { passwordSchema } from "@/features/auth/passwordRules";
import { RoleBadge } from "@/features/users/userUtils";
import { ROLES } from "@/lib/constants";
import * as authApi from "@/services/api/auth.api";
import { getErrorMessage, getFieldErrors } from "@/services/api/client";

const schema = z
  .object({
    current_password: z.string().min(1, "Password lama wajib diisi"),
    new_password: passwordSchema,
    confirm: z.string().min(1, "Konfirmasi password wajib diisi"),
  })
  .refine((v) => v.new_password === v.confirm, { path: ["confirm"], message: "Konfirmasi password tidak sama" })
  .refine((v) => v.new_password !== v.current_password, { path: ["new_password"], message: "Password baru harus berbeda dari password lama" });

export default function ProfilePage() {
  const { user } = useAuth();
  const [formError, setFormError] = useState("");
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { current_password: "", new_password: "", confirm: "" } });
  const newPassword = useWatch({ control, name: "new_password" }) ?? "";

  const onSubmit = async ({ current_password, new_password }) => {
    setFormError("");
    try {
      await authApi.changePassword({ current_password, new_password });
      toast.success("Password berhasil diubah.");
      reset();
    } catch (err) {
      const fields = getFieldErrors(err);
      fields.forEach((f) => setError(f.field === "new_password" ? "new_password" : f.field, { message: f.message }));
      if (!fields.length) setFormError(getErrorMessage(err, "Gagal mengubah password. Coba lagi."));
    }
  };

  const initial = user.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <>
      <PageHeader title="Profil" description="Informasi akun Anda dan pengaturan keamanan." />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="self-start rounded-card bg-surface p-6 shadow-card" aria-labelledby="akun-heading">
          <h2 id="akun-heading" className="font-display text-lg font-semibold">Informasi Akun</h2>
          <div className="mt-5 flex items-center gap-4">
            <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-primary text-2xl font-semibold text-white">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold">{user.name}</p>
              <div className="mt-1"><RoleBadge role={user.role} /></div>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div>
              <dt className="text-ink-muted">Nama</dt>
              <dd className="mt-0.5 font-medium">{user.name}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Email</dt>
              <dd className="mt-0.5 break-all font-medium">{user.email}</dd>
            </div>
          </dl>
          <p className="mt-5 rounded-lg bg-canvas p-3 text-[13px] text-ink-muted">
            {user.role === ROLES.OWNER
              ? "Nama, email, dan role diubah di menu Manajemen Akun."
              : "Untuk mengubah nama, email, atau role, hubungi Owner."}
          </p>
        </section>

        <section className="rounded-card bg-surface p-6 shadow-card" aria-labelledby="pw-heading">
          <h2 id="pw-heading" className="font-display text-lg font-semibold">Ubah Password</h2>
          <p className="mt-1 text-sm text-ink-muted">Masukkan password lama, lalu buat password baru.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 max-w-md space-y-4">
            {formError && (
              <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger-ink">
                {formError}
              </div>
            )}
            <PasswordField label="Password lama" autoComplete="current-password" error={errors.current_password?.message} {...register("current_password")} />
            <PasswordField label="Password baru" autoComplete="new-password" error={errors.new_password?.message} {...register("new_password")} />
            <PasswordStrength password={newPassword} />
            <PasswordField label="Konfirmasi password baru" autoComplete="new-password" error={errors.confirm?.message} {...register("confirm")} />
            <Button type="submit" loading={isSubmitting}>
              {isSubmitting ? "Menyimpan…" : "Simpan password"}
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
