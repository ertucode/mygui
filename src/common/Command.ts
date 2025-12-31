import z from "zod";

export const CommandParameterType = z
  .object({
    type: z.enum(["string", "path"]),
  })
  .or(
    z.object({
      type: z.literal("select"),
      options: z.array(
        z.object({
          label: z.string(),
          value: z.string(),
        }),
      ),
    }),
  );

export const CommandMenuConfig = z.object({
  placement: z.enum(["inline", "menu"]).default("menu"),
  priority: z.number().default(0),
});
export type CommandMenuConfig = z.infer<typeof CommandMenuConfig>;

export const CommandParameter = z
  .object({
    name: z.string(),
    label: z.string().nullish(),
    initialValue: z.string().nullish(),
  })
  .and(CommandParameterType);

export const CommandMetadata = z.object({
  name: z.string(),
  parameters: CommandParameter.array().nullish(),
  glob: z.string().nullish(),
  menu: CommandMenuConfig.nullish(),
});

export type CommandMetadata = z.infer<typeof CommandMetadata>;
export type CommandParameter = z.infer<typeof CommandParameter>;

export const CommandReport = z.object({
  type: z.literal("reload-path"),
  path: z.string(),
  fileToSelect: z.string().nullish(),
});
export type CommandReport = z.infer<typeof CommandReport>;
