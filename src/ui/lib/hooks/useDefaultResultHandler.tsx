import { errorResponseToMessage, GenericResult } from "@common/GenericError";
import { useMemo } from "react";
import { useToast } from "../components/toast";

export type ResultHandlerResult = GenericResult<unknown> | { noResult: true };
export type ResultHandlerAdditional = {
  success?: () => void;
  error?: () => void;
};
export function useDefaultResultHandler() {
  const toast = useToast();

  return useMemo(() => {
    return {
      onResult: (
        result: ResultHandlerResult,
        additional?: { success?: () => void; error?: () => void },
      ) => {
        if ("noResult" in result) return;
        if (result.success) {
          additional?.success?.();
          toast.show({
            severity: "success",
            message: "Başarıyla tamamlandı",
          });
        } else {
          additional?.error?.();
          toast.show({
            severity: "error",
            message: errorResponseToMessage(result.error),
          });
        }
      },
      toast,
    };
  }, [toast]);
}
