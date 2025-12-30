import z from "zod";

export const CommandParameter = z
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

export const CommandMetadata = z.object({
  name: z.string(),
  parameters: CommandParameter.array().nullish(),
  glob: z.string().nullish(),
});

export type CommandMetadata = z.infer<typeof CommandMetadata>;
export type CommandParameter = z.infer<typeof CommandParameter>;
