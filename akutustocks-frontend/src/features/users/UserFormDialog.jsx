import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import Select from "@/components/ui/Select";
import { ROLES, ROLE_LABEL } from "@/lib/constants";
import { getErrorMessage, getFieldErrors } from "@/services/api/client";

const schema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100, "Nama terlalu panjang"),
  email: z.string().trim().min(1, "Email wajib diisi").email("Format email tidak valid"),
  role: z.enum([ROLES.SPV, ROLES.STAFF, ROLES.OWNER], { message: "Pilih role" }),
});

const ROLE_OPTIONS = [ROLES.STAFF, ROLES.SPV, ROLES.OWNER].map((r) => ({ value: r, label: ROLE_LABEL[r] }));

/** user = null → mode tambah; user = objek → mode ubah. onSubmit(values) harus melempar error bila gagal. */
export default function UserFormDialog({ open, user, onClose, onSubmit }) {
  const isEdit = Boolean(user);
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", role: ROLES.STAFF } });

  useEffect(() => {
    if (open) {
      setFormError("");
      reset(user ? { name: user.name, email: user.email, role: user.role } : { name: "", email: "", role: ROLES.STAFF });
    }
  }, [open, user, reset]);

  const submit = async (values) => {
    setFormError("");
    try {
      await onSubmit(values);
    } catch (err) {
      const fields = getFieldErrors(err);
      fields.forEach((f) => setError(f.field, { message: f.message }));
      if (!fields.length) setFormError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={isSubmitting}
      title={isEdit ? "Ubah Akun" : "Tambah Akun"}
      description={isEdit ? "Perbarui data pengguna." : "Tautan aktivasi akan dikirim ke email pengguna. Password dibuat sendiri oleh pengguna."}
    >
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        {formError && (
          <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger-ink">
            {formError}
          </div>
        )}
        <FormField label="Nama lengkap" autoComplete="off" error={errors.name?.message} {...register("name")} />
        <FormField label="Email" type="email" autoComplete="off" error={errors.email?.message} {...register("email")} />
        <Select label="Role" options={ROLE_OPTIONS} error={errors.role?.message} {...register("role")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? "Simpan perubahan" : "Buat akun"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
