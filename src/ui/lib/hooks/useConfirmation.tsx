import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Dialog } from "@/lib/components/dialog";

type ConfirmationOptions = {
  title: string;
  message: ReactNode;
  onConfirm: () => void | Promise<void>;
  onReject?: () => void;
  confirmText?: string;
  rejectText?: string;
};

type ConfirmationContextType = {
  confirm: (options: ConfirmationOptions) => void;
  isOpen: boolean;
};

const ConfirmationContext = createContext<ConfirmationContextType | null>(null);

// Global confirmation manager - available anywhere, even outside React
class ConfirmationManager {
  private confirmFn: ((options: ConfirmationOptions) => void) | null = null;

  setConfirmFunction(fn: (options: ConfirmationOptions) => void) {
    this.confirmFn = fn;
  }

  confirm(options: ConfirmationOptions) {
    if (!this.confirmFn) {
      console.warn("Confirmation system not initialized yet");
      return;
    }
    this.confirmFn(options);
  }
}

// Export a singleton instance
export const confirmation = new ConfirmationManager();

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmationOptions | null>(null);

  const confirm = (options: ConfirmationOptions) => {
    setState(options);
  };

  const handleConfirm = async () => {
    if (!state) return;
    await state.onConfirm();
    setState(null);
  };
  // Register the show function with the global toast manager
  useEffect(() => {
    confirmation.setConfirmFunction(confirm);
  }, [confirm]);

  const handleReject = () => {
    if (!state) return;
    state.onReject?.();
    setState(null);
  };

  return (
    <ConfirmationContext.Provider value={{ confirm, isOpen: state != null }}>
      {children}
      {state && (
        <Dialog onClose={handleReject} className="max-w-[60vw]">
          <h3 className="font-bold text-lg mb-4">{state.title}</h3>
          <div className="mb-4">{state.message}</div>
          <div className="modal-action">
            <button
              className="btn btn-primary"
              autoFocus
              onClick={handleConfirm}
            >
              {state.confirmText || "Confirm"}
            </button>
            <button className="btn" onClick={handleReject}>
              {state.rejectText || "Cancel"}
            </button>
          </div>
        </Dialog>
      )}
    </ConfirmationContext.Provider>
  );
}

export function useConfirmation() {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error("useConfirmation must be used within ConfirmationProvider");
  }
  return context;
}
