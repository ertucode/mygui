import { useForm, UseFormProps, UseFormReturn } from "react-hook-form";
import { arktypeResolver } from "@hookform/resolvers/arktype";
import { ComponentType, ReactNode, Ref, useEffect, useMemo } from "react";
import {
  FormFieldConfig,
  FormFieldFromConfigWrapper,
} from "../form/FormFieldFromConfig";
import {
  ResultHandlerResult,
  useDefaultResultHandler,
} from "@/lib/hooks/useDefaultResultHandler";
import { ZodType } from "zod";
import { Dialog } from "@/lib/components/dialog";
import { DialogForItem } from "@/lib/hooks/useDialogForItem";
import { Button } from "@/lib/components/button";
import { useDialogStoreDialog } from "@/features/file-browser/dialogStore";

export type CreateFormDialogOpts<
  TItem,
  TRequest extends Record<string, any>,
  TProps extends BaseProps,
> = {
  schema: ZodType<TRequest>;
  getFormParams: (item: TItem | undefined) => UseFormProps<TRequest, any>;
  translationNamespace?: string[];
  props?: TProps;
  action: (
    body: TRequest,
    props: TProps,
    item: TItem,
  ) => Promise<ResultHandlerResult>;
  onSuccessBehavior?: {
    resetForm?: boolean;
    closeDialog?: boolean;
    noToastOnSuccess?: boolean;
  };
  getConfigs: (
    hookForm: UseFormReturn<TRequest>,
    item: TItem | undefined,
  ) => FormFieldConfig<keyof TRequest & string>[];
  getTexts: () => {
    title: ReactNode;
    buttonLabel: ReactNode;
    buttonIcon?: React.ComponentType<{ className?: string }>;
  };
  extraButtons?: (formId: string) => ReactNode;
  dialogButtonOpts?: () => {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  };
  formId?: string;
  Wrapper?: ComponentType<{
    children: ReactNode;
    hookForm: UseFormReturn<TRequest>;
    item: TItem | undefined;
  }>;
  dialogContentStyle?: React.CSSProperties;
  asyncInitialData?: (item: TItem | undefined) => Promise<TRequest | undefined>;
};

// without ref
type BaseProps = Omit<Record<string, any>, "ref">;
export type FormDialogProps<TItem, TProps extends BaseProps> = [TItem] extends [
  never,
]
  ? { ref?: undefined } & TProps
  : {
      ref: Ref<DialogForItem<TItem>>;
    } & TProps;

const defaultOnSuccessBehavior = {
  resetForm: true,
  closeDialog: true,
};

export function createFormDialog<
  TItem,
  TForm extends Record<string, any>,
  TProps extends BaseProps,
>(opts: CreateFormDialogOpts<TItem, TForm, TProps>) {
  const formId = opts.formId ?? "dialog-form";
  return function ({ ref, ...props }: FormDialogProps<TItem, TProps>) {
    const { item, dialogOpen, onClose } = useDialogStoreDialog(ref);

    const formParams = useMemo(() => opts.getFormParams(item), [item]);
    const hookForm = useForm<TForm>({
      ...formParams,
      resolver: arktypeResolver(opts.schema),
    });

    const {
      register,
      handleSubmit,
      control,
      formState: { isSubmitting, errors },
    } = hookForm;

    const { onResult } = useDefaultResultHandler();
    async function onSubmit(data: TForm) {
      const result = await opts.action(data, props as any as TProps, item!);

      onResult(result, {
        success: () => {
          const onSuccessBehavior = {
            ...defaultOnSuccessBehavior,
            ...opts.onSuccessBehavior,
          };

          if (onSuccessBehavior.resetForm) {
            hookForm.reset();
          }
          if (onSuccessBehavior.closeDialog) {
            onClose();
          }
        },
        noToastOnSuccess: opts.onSuccessBehavior?.noToastOnSuccess,
      });
    }

    useEffect(() => {
      if (opts.asyncInitialData) {
        opts.asyncInitialData(item).then((data) => {
          if (data) {
            hookForm.reset(data);
          }
        });
      }
    }, [item]);

    const configs = useMemo(
      () => opts.getConfigs(hookForm, item),
      [hookForm, item],
    );

    const text = opts.getTexts();

    const dialogButtonOpts = opts.dialogButtonOpts?.();

    const renderedForm = (
      <form
        onSubmit={handleSubmit(onSubmit)}
        id={formId}
        className="flex flex-col gap-3"
      >
        <FormFieldFromConfigWrapper
          hookForm={{
            register,
            control,
            formState: { errors: errors as any },
          }}
          configs={configs}
        ></FormFieldFromConfigWrapper>
      </form>
    );

    const content = opts.Wrapper ? (
      <opts.Wrapper hookForm={hookForm} item={item}>
        {renderedForm}
      </opts.Wrapper>
    ) : (
      renderedForm
    );

    return (
      <>
        {dialogButtonOpts && (
          <button type="button" className="button">
            <dialogButtonOpts.icon className="h-5 w-5" />{" "}
            {dialogButtonOpts.label}
          </button>
        )}
        {dialogOpen && (
          <Dialog
            onClose={onClose}
            style={opts.dialogContentStyle}
            title={text.title}
            className="max-w-[100] w-100"
            footer={
              <>
                {opts.extraButtons?.(formId)}
                <Button
                  pending={isSubmitting}
                  form={formId}
                  type="submit"
                  icon={text.buttonIcon}
                >
                  {text.buttonLabel}
                </Button>
              </>
            }
          >
            {content}
          </Dialog>
        )}
      </>
    );
  };
}
