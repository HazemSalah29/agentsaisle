// A small JSON Schema validator for the subset video.schema.json uses. typeOk and validate below are a
// byte-identical copy of the ones in arch-visualize/scripts/model-check.mjs (a test keeps them in step).
const typeOk = (t, v) =>
  t === "array"
    ? Array.isArray(v)
    : t === "object"
      ? v && typeof v === "object" && !Array.isArray(v)
      : t === "integer"
        ? Number.isInteger(v)
        : typeof v === t;

/** Validate `value` against the subset of JSON Schema the model schema uses. Returns problems. */
export function validate(schema, value, root = schema, at = "$") {
  const out = [];
  if (schema.$ref) {
    const target = schema.$ref
      .replace(/^#\//, "")
      .split("/")
      .reduce((o, k) => o?.[k], root);
    return validate(target, value, root, at);
  }
  if (schema.anyOf) {
    if (!schema.anyOf.some((sub) => validate(sub, value, root, at).length === 0))
      out.push(`${at}: "${String(value).slice(0, 40)}" is not an allowed value`);
    return out;
  }
  if ("const" in schema && value !== schema.const)
    out.push(`${at}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value))
    out.push(`${at}: "${String(value).slice(0, 40)}" is not one of ${schema.enum.join(", ")}`);
  if (schema.type && !typeOk(schema.type, value)) return [...out, `${at}: expected ${schema.type}`];
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) out.push(`${at}: is empty`);
    if (schema.maxLength && value.length > schema.maxLength)
      out.push(`${at}: longer than ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      out.push(`${at}: "${value.slice(0, 40)}" has the wrong format`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum)
    out.push(`${at}: must be at least ${schema.minimum}`);
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      out.push(`${at}: at most ${schema.maxItems} items`);
    if (schema.minItems !== undefined && value.length < schema.minItems)
      out.push(`${at}: at least ${schema.minItems} item(s)`);
    if (schema.items)
      value.forEach((v, i) => out.push(...validate(schema.items, v, root, `${at}[${i}]`)));
  } else if (value && typeof value === "object") {
    for (const k of schema.required ?? []) if (!(k in value)) out.push(`${at}: missing "${k}"`);
    for (const [k, sub] of Object.entries(schema.properties ?? {}))
      if (k in value) out.push(...validate(sub, value[k], root, `${at}.${k}`));
  }
  return out;
}
