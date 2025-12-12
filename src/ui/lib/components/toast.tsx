import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { CheckCircle, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { errorResponseToMessage, GenericError } from "@common/GenericError";

export type ToastSeverity = "success" | "error" | "warning" | "info";
export type ToastLocation =
  | "top-left"
  | "top-right"
  | "top-center"
  | "bottom-left"
  | "bottom-right"
  | "bottom-center";

export interface ToastOptions {
  title?: ReactNode;
  message?: ReactNode;
  severity: ToastSeverity;
  timeout?: number;
  location?: ToastLocation;
}

interface Toast extends ToastOptions {
  id: string;
}

interface ToastContextType {
  show: (options: ToastOptions | GenericError.ResultType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
};

const getLocationClasses = (location: ToastLocation = "top-right") => {
  const baseClasses = "toast";
  switch (location) {
    case "top-left":
      return `${baseClasses} toast-start toast-top`;
    case "top-right":
      return `${baseClasses} toast-end toast-top`;
    case "top-center":
      return `${baseClasses} toast-center toast-top`;
    case "bottom-left":
      return `${baseClasses} toast-start toast-bottom`;
    case "bottom-right":
      return `${baseClasses} toast-end toast-bottom`;
    case "bottom-center":
      return `${baseClasses} toast-center toast-bottom`;
    default:
      return `${baseClasses} toast-end toast-bottom`;
  }
};

const getSeverityIcon = (severity: ToastSeverity) => {
  switch (severity) {
    case "success":
      return <CheckCircle className="shrink-0 h-6 w-6 stroke-success" />;
    case "error":
      return <XCircle className="shrink-0 h-6 w-6 stroke-error" />;
    case "warning":
      return <AlertTriangle className="shrink-0 h-6 w-6 stroke-warning" />;
    case "info":
      return <Info className="shrink-0 h-6 w-6 stroke-info" />;
  }
};

const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({
  toast,
  onClose,
}) => {
  return (
    <div
      className={`alert alert-vertical sm:alert-horizontal shadow-lg min-w-[300px] max-w-md`}
    >
      {getSeverityIcon(toast.severity)}
      <div>
        <h3 className="font-bold">
          {toast.title && <h3 className="font-bold">{toast.title}</h3>}
        </h3>
        <div className="text-xs">
          {toast.message && <div className="text-xs">{toast.message}</div>}
        </div>
      </div>
      <button
        className="btn btn-sm btn-circle btn-ghost"
        onClick={() => onClose(toast.id)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (opts: ToastOptions | GenericError.ResultType) => {
      const options: ToastOptions =
        "error" in opts
          ? {
              severity: "error",
              message: errorResponseToMessage(opts.error),
            }
          : opts;
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { ...options, id };

      setToasts((prev) => [...prev, newToast]);

      if (options.timeout !== Infinity && options.timeout !== undefined) {
        setTimeout(() => {
          removeToast(id);
        }, options.timeout);
      } else if (options.timeout === undefined) {
        // Default timeout: 5 seconds
        setTimeout(() => {
          removeToast(id);
        }, 5000);
      }
    },
    [removeToast],
  );

  // Group toasts by location
  const toastsByLocation = toasts.reduce(
    (acc, toast) => {
      const location = toast.location || "top-right";
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(toast);
      return acc;
    },
    {} as Record<ToastLocation, Toast[]>,
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {Object.entries(toastsByLocation).map(([location, locationToasts]) => (
        <div
          key={location}
          className={getLocationClasses(location as ToastLocation)}
        >
          {locationToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </div>
      ))}
    </ToastContext.Provider>
  );
};
