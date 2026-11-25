import { useEffect, useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Drawer from "@/components/ui/Drawer";
import Button from "@/components/ui/Button";
import FormField from "@/components/ui/FormField";
import FileUploader from "@/components/ui/FileUploader";
import { getErrorMessage, getFieldErrors } from "@/services/api/client";

const schema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kode minimal 2 karakter")
    .max(30, "Kode maksimal 30 karakter")
    .regex(/^[A-Za-z0-9._-]+$/, "Kode hanya boleh huruf, angka, titik, strip, atau garis bawah"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(150, "Nama terlalu panjang"),
  category: z.string().trim().min(1, "Kategori wajib diisi").max(60, "Kategori terlalu panjang"),
  min_stock: z
    .number({ message: "Batas minimum wajib diisi" })
    .int("Harus bilangan bulat")
    .min(0, "Tidak boleh negatif")
    .max(100000, "Terlalu besar"),
});

const EMPTY = { code: "", name: "", category: "", min_stock: undefined };

/** product = null → tambah; product = objek → ubah. onSubmit({ ...values, image, removeImage }) melempar error bila gagal. */
export default function ProductFormDrawer({ open, product, categories, onClose, onSubmit }) {
  const isEdit = Boolean(product);
  const formId = useId();
  const listId = useId();
  const [image, setImage] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [formError, setFormError] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (!open) return;
    setFormError("");
    setImage(null);
    setRemoveImage(false);
    reset(product ? { code: product.code, name: product.name, category: product.category ?? "", min_stock: product.min_stock } : EMPTY);
  }, [open, product, reset]);

  const submit = async (values) => {
    setFormError("");
    try {
      await onSubmit({ ...values, image, removeImage });
    } catch (err) {
      const fields = getFieldErrors(err);
      fields.forEach((f) => setError(f.field, { message: f.message }));
      if (!fields.length) setFormError(getErrorMessage(err));
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      busy={isSubmitting}
      title={isEdit ? "Ubah Barang" : "Tambah Barang"}
      description={isEdit ? "Perbarui informasi barang. Jumlah stok diubah lewat transaksi stok." : "Lengkapi informasi barang baru untuk ditambahkan ke katalog. Stok awal 0; isi lewat transaksi Barang Masuk."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button type="submit" form={formId} loading={isSubmitting}>
            {isEdit ? "Simpan perubahan" : "Simpan Barang"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit(submit)} noValidate className="space-y-5">
        {formError && (
          <div role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm font-medium text-danger-ink">
            {formError}
          </div>
        )}

        <FileUploader
          label="Foto produk (opsional)"
          hint="JPG, PNG, atau WebP, maksimal 2 MB."
          file={image}
          existingUrl={removeImage ? null : product?.image_url}
          onChange={(f) => { setImage(f); if (f) setRemoveImage(false); }}
          onRemoveExisting={() => setRemoveImage(true)}
        />

        <h3 className="border-t border-line pt-5 font-display text-base font-semibold">Informasi Barang</h3>
        <FormField label="Kode barang / SKU *" placeholder="Contoh: ACT-002" hint="Gunakan kode unik yang belum terdaftar di katalog." error={errors.code?.message} autoComplete="off" {...register("code")} />
        <FormField label="Nama barang *" placeholder="Contoh: Funko Pop! Iron Man" error={errors.name?.message} autoComplete="off" {...register("name")} />
        <FormField
          label="Kategori produk *"
          placeholder="Pilih atau ketik kategori"
          list={listId}
          hint="Pilih kategori yang sudah ada, atau ketik kategori baru."
          error={errors.category?.message}
          autoComplete="off"
          {...register("category")}
        />
        <datalist id={listId}>
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>

        <h3 className="border-t border-line pt-5 font-display text-base font-semibold">Pengaturan Stok</h3>
        <FormField
          label="Batas minimum stok *"
          type="number"
          inputMode="numeric"
          min={0}
          placeholder="Contoh: 10"
          hint="Barang ditandai Stok Menipis bila total stok sama dengan atau di bawah batas ini."
          error={errors.min_stock?.message}
          {...register("min_stock", { valueAsNumber: true })}
        />
      </form>
    </Drawer>
  );
}
