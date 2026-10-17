import { z } from "zod";
import {
  ActionCardBlockSchema,
  ContextUsedBlockSchema,
  ErrorBlockSchema,
  FindingsBlockSchema,
  MessageBlockSchema,
  MetricBlockSchema,
  QuestionWithOptionsBlockSchema,
  RecommendationBlockSchema,
  TaskProgressBlockSchema,
  TextBlockSchema,
  ImagePreviewBlockSchema,
} from "@/types";

export { MessageBlockSchema, ImagePreviewBlockSchema };
export type { AnyBlock, MessageBlock } from "@/types";
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type FindingsBlock = z.infer<typeof FindingsBlockSchema>;
export type RecommendationBlock = z.infer<typeof RecommendationBlockSchema>;
export type MetricBlock = z.infer<typeof MetricBlockSchema>;
export type ActionCardBlock = z.infer<typeof ActionCardBlockSchema>;
export type TaskProgressBlock = z.infer<typeof TaskProgressBlockSchema>;
export type ContextUsedBlock = z.infer<typeof ContextUsedBlockSchema>;
export type QuestionWithOptionsBlock = z.infer<typeof QuestionWithOptionsBlockSchema>;
export type ErrorBlock = z.infer<typeof ErrorBlockSchema>;
export type ImagePreviewBlock = z.infer<typeof ImagePreviewBlockSchema>;
