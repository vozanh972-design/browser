import { toast } from "sonner";

export const showToast = (message: string, description?: string) => {
  toast(message, { description });
};

export const showSuccessToast = (message: string, description?: string) => {
  toast.success(message, { description });
};

export const showErrorToast = (message: string, description?: string) => {
  toast.error(message, { description });
};

export const dismissToast = (id?: string | number) => {
  toast.dismiss(id);
};
