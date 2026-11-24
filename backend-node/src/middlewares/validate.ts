import { z } from "zod";
import { AppError } from "../errors/AppError";
import { describeIssues } from "../schemas/common";

export const NOT_AN_OBJECT_MESSAGE = "Os dados devem ser um objeto JSON.";

/**
 * Valida um dado de entrada; se inválido, lança VALIDATION_ERROR com os detalhes.
 * Esquemas de objeto exigem um objeto JSON de verdade (nem lista, nem número).
 */
export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  if (schema instanceof z.ZodObject && (typeof data !== "object" || data === null || Array.isArray(data))) {
    throw new AppError("VALIDATION_ERROR", "Dados inválidos.", [{ field: null, message: NOT_AN_OBJECT_MESSAGE }]);
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError("VALIDATION_ERROR", "Dados inválidos.", describeIssues(result.error));
  }
  return result.data;
}
