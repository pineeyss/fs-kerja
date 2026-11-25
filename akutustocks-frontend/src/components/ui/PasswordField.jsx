import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import FormField from "./FormField";

const PasswordField = forwardRef(function PasswordField(props, ref) {
  const [show, setShow] = useState(false);
  return (
    <FormField
      ref={ref}
      type={show ? "text" : "password"}
      rightSlot={
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          className="grid size-10 place-items-center rounded-md text-ink hover:bg-canvas"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      }
      {...props}
    />
  );
});

export default PasswordField;
