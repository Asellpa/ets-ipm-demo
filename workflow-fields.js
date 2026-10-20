const PROJECT_FIELDS = new Set([
  "title",
  "client",
  "scope",
  "startDate",
  "edd",
  "owner",
  "aircraft",
  "registration",
  "releaseType",
  "sector",
  "priority",
  "requiredInputs",
  "deliverables",
  "clientFocal",
  "doaFocal",
  "site",
  "sage",
  "nreStatus",
  "remarks",
]);
const PRICING_FIELDS = new Set([
  "rom",
  "poStatus",
  "negotiationNotes",
  "offerDetails",
  "agreementDetails",
]);
const TYPES = new Set([
  "text",
  "textarea",
  "date",
  "number",
  "select",
  "checkbox",
]);
const field = (id, label, type = "text", required = false, extra = {}) => ({
  id,
  label,
  type,
  required,
  dataGroup: "general",
  ...extra,
});
function fieldsFor(node) {
  return node.fields !== undefined
    ? node.fields
    : (node.requiredFields || []).map((label) =>
        field(label, label, "textarea", true),
      );
}
function visibleFields(node, p, ps) {
  return fieldsFor(node).filter(
    (f) =>
      f.dataGroup !== "commercial" ||
      (p.type === "commercial" && ps.viewCommercialFields),
  );
}
function applies(f, p) {
  return f.dataGroup !== "commercial" || p.type === "commercial";
}
function validateSchema(node) {
  const fields = fieldsFor(node);
  if (!Array.isArray(fields) || fields.length > 40)
    return "An object supports up to 40 fields";
  const ids = new Set();
  for (const f of fields) {
    if (
      !f ||
      typeof f.id !== "string" ||
      !f.id ||
      f.id.length > 200 ||
      ids.has(f.id) ||
      typeof f.label !== "string" ||
      !f.label.trim() ||
      f.label.length > 120 ||
      !TYPES.has(f.type) ||
      typeof f.required !== "boolean" ||
      !["general", "commercial"].includes(f.dataGroup || "general")
    )
      return "Invalid or duplicate object field";
    ids.add(f.id);
    if (
      f.projectField &&
      !PROJECT_FIELDS.has(f.projectField) &&
      !PRICING_FIELDS.has(f.projectField)
    )
      return "Invalid project field mapping";
    if (PRICING_FIELDS.has(f.projectField) && f.dataGroup !== "commercial")
      return "Pricing fields must use the restricted commercial data group";
    if (
      f.type === "select" &&
      (!Array.isArray(f.options) ||
        !f.options.length ||
        f.options.length > 50 ||
        f.options.some(
          (o) => typeof o !== "string" || !o.trim() || o.length > 150,
        ) ||
        new Set(f.options).size !== f.options.length)
    )
      return "Choice fields need unique non-empty options";
    if (f.min !== undefined && (f.type !== "number" || !Number.isFinite(f.min)))
      return "Invalid minimum value";
  }
  const mappings = fields
    .filter((f) => f.projectField)
    .map((f) => f.projectField);
  if (new Set(mappings).size !== mappings.length)
    return "Map a project field only once per object";
  return "";
}
function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= "1900-01-01" &&
    value <= "2100-12-31" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
function validateValues(node, p, ps, values) {
  if (!values || typeof values !== "object" || Array.isArray(values))
    return { error: "Invalid object field values" };
  const updates = {},
    pricing = {};
  for (const [id, value] of Object.entries(values)) {
    const f = fieldsFor(node).find((f) => f.id === id);
    if (!f) return { error: "Unknown object field" };
    if (!visibleFields(node, p, ps).some((v) => v.id === id))
      return {
        error: "You do not have permission to update one or more fields",
        status: 403,
      };
    if (typeof value !== "string" || value.length > 5000)
      return { error: "Field values must be text up to 5000 characters" };
    if (value) {
      if (f.type === "date" && !validDate(value))
        return {
          error: f.label + ": enter a valid date between 1900 and 2100",
        };
      if (
        f.type === "number" &&
        (!Number.isFinite(Number(value)) ||
          (f.min !== undefined && Number(value) < f.min))
      )
        return {
          error:
            f.label +
            ": enter a valid number" +
            (f.min !== undefined ? " of at least " + f.min : ""),
        };
      if (f.type === "select" && !f.options.includes(value))
        return { error: f.label + ": choose a configured option" };
      if (f.type === "checkbox" && !["true", "false"].includes(value))
        return { error: f.label + ": invalid checkbox value" };
    }
    if (f.projectField) {
      if (f.projectField === "title" && !value.trim()) continue;
      if (f.projectField === "title" && value.length > 200)
        return { error: "Project name must be at most 200 characters" };
      if (PRICING_FIELDS.has(f.projectField)) pricing[f.projectField] = value;
      else updates[f.projectField] = value;
    }
  }
  const candidate = { ...p, ...updates };
  if (
    candidate.startDate &&
    candidate.edd &&
    candidate.edd < candidate.startDate
  )
    return { error: "Expected delivery date cannot precede start date" };
  return { updates, pricing };
}
function missingRequired(node, state, p) {
  return fieldsFor(node).some(
    (f) =>
      applies(f, p) &&
      f.required &&
      (!Object.hasOwn(state.values || {}, f.id) ||
        !(f.type === "checkbox"
          ? state.values[f.id] === "true"
          : String(state.values[f.id] || "").trim())),
  );
}
function defaultNodes(names) {
  const node = (id, name, parent = "", fields = []) => ({
    id,
    name,
    type: parent ? "object" : "stage",
    parent,
    completion: "manual",
    permissions: {},
    parallelWithPrevious: false,
    requiredFields: [],
    taskTemplates: [],
    fields,
  });
  return [
    node("phase-0", names[0], "", [
      field("project-name", "Project name", "text", true, {
        projectField: "title",
      }),
      field("start-date", "Start date", "date", true, {
        projectField: "startDate",
      }),
      field("scope", "Scope", "textarea", true, { projectField: "scope" }),
      field("client", "Client / department", "text", false, {
        projectField: "client",
      }),
    ]),
    node("phase-1", names[1], "", [
      field("delivery-date", "Expected delivery date", "date", false, {
        projectField: "edd",
      }),
      field("planning-notes", "Planning notes", "textarea"),
    ]),
    node("phase-2", names[2], "", [
      field("implementation-notes", "Implementation notes", "textarea"),
    ]),
    node("phase-3", names[3], "", [
      field("review-comments", "Review comments", "textarea", true),
    ]),
    node("phase-4", names[4], "", [
      field("handover-date", "Handover date", "date", true),
      field("deliverables", "Deliverables", "textarea", true, {
        projectField: "deliverables",
      }),
    ]),
    node("phase-5", names[5], "", [
      field("closure-notes", "Closure notes", "textarea", true),
    ]),
    node("overview-details", "Details", "phase-0", [
      field("aircraft", "Aircraft", "text", false, {
        projectField: "aircraft",
      }),
      field("registration", "Registration", "text", false, {
        projectField: "registration",
      }),
      field("required-inputs", "Required inputs", "textarea", false, {
        projectField: "requiredInputs",
      }),
    ]),
    node("overview-budget", "Budget", "phase-0", [
      field("estimated-hours", "Estimated hours", "number", false, { min: 0 }),
      field("rom", "ROM / pricing", "textarea", false, {
        dataGroup: "commercial",
        projectField: "rom",
      }),
      field("po-status", "PO status", "text", false, {
        dataGroup: "commercial",
        projectField: "poStatus",
      }),
    ]),
    node("planning-team", "Team", "phase-1", [
      field("team", "Team members and responsibilities", "textarea", true),
    ]),
    node("planning-roles", "Supervision", "phase-1", [
      field(
        "responsibilities",
        "Supervision and escalation arrangements",
        "textarea",
        true,
      ),
    ]),
  ];
}
module.exports = {
  fieldsFor,
  visibleFields,
  validateSchema,
  validateValues,
  missingRequired,
  defaultNodes,
};
