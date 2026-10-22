const crypto = require("node:crypto");
const F = require("./workflow-fields");
const Tracker = require("./commercial-tracker-template");
const LIFECYCLE = [
  "Overview",
  "Planning",
  "Implementation",
  "Review & Approval",
  "Delivery",
  "Closure",
];
const ACCESS = ["hidden", "view", "edit", "complete", "approve"];
function standardNodes() {
  return F.defaultNodes(LIFECYCLE);
}
function defaultConfig() {
 return {templateCatalog:{simplifiedProjects:2,commercialTracker:1},workflows:[Tracker.projects(),{id:'eer',name:'Internal',stages:[...LIFECYCLE],objects:[],nodes:standardNodes()}],projectTypes:[{id:'commercial',name:'Projects',workflowId:'commercial'},{id:'internal_eer',name:'Internal',workflowId:'eer'}],register:{},resource:{standardHoursPerDay:8}};
}
function nodesFor(w) {
  const nodes = w.nodes?.length
    ? structuredClone(w.nodes)
    : (w.stages || []).map((name, i) => ({
        id: "stage-" + i,
        name,
        type: "stage",
        parent: "",
        completion: "manual",
        permissions: {},
      }));
  for (const o of w.objects || [])
    if (!nodes.some((n) => n.id === o.id))
      nodes.push({
        id: o.id,
        name: o.name,
        type: "object",
        parent:
          o.parent ||
          nodes.find((n) => n.type === "stage" && n.name === o.stage)?.id ||
          "",
        completion: "manual",
        permissions: o.permissions || {},
      });
  return nodes.map((n) => ({
    ...n,
    parallelWithPrevious: !!n.parallelWithPrevious,
    requiredFields: n.requiredFields || [],
    taskTemplates: n.taskTemplates || [],
  }));
}
function upgradeConfig(config) {
  if (!config) return defaultConfig();
  const cfg = structuredClone(config);
  if(!cfg.templateCatalog?.simplifiedProjects){
    const next=defaultConfig();cfg.workflows=next.workflows;cfg.projectTypes=next.projectTypes;cfg.templateCatalog={...cfg.templateCatalog,...next.templateCatalog};return cfg;
  }

  for (const w of cfg.workflows) {
    const nodes = nodesFor(w),
      roots = nodes.filter((n) => !n.parent);
    const names = roots.map((n) => n.name).join("|");
    if (
      ["commercial", "eer"].includes(w.id) &&
      roots.length === 6 &&
      nodes.length === 6 &&
      roots.every(
        (n, i) =>
          n.name === LIFECYCLE[i] &&
          !n.fields &&
          !n.requiredFields.length &&
          !n.taskTemplates.length,
      )
    ) {
      const defaults = standardNodes();
      const ids = Object.fromEntries(
        defaults.slice(0, 6).map((n, i) => [n.id, roots[i].id]),
      );
      w.nodes = defaults.map((n) =>
        n.parent
          ? { ...n, parent: ids[n.parent] }
          : {
              ...n,
              id: ids[n.id],
              permissions:
                roots.find((r) => r.id === ids[n.id])?.permissions || {},
            },
      );
      w.objects = [];
      continue;
    }
    if (
      names === "RFQ|Awarded|In Progress|Escalated|Completed" ||
      names === "Raised|Review|Planning|In Progress|Sign-off|Completed"
    ) {
      if (roots.length === 5) {
        const labels = [
          LIFECYCLE[0],
          LIFECYCLE[1],
          LIFECYCLE[2],
          LIFECYCLE[3],
          LIFECYCLE[5],
        ];
        roots.forEach((n, i) => {
          n.name = labels[i];
        });
        nodes.splice(nodes.indexOf(roots[4]), 0, {
          ...standardNodes()[4],
          id: "delivery-" + w.id,
        });
      } else
        roots.forEach((n, i) => {
          n.name = LIFECYCLE[i];
        });
      w.nodes = nodes;
      w.stages = nodes.filter((n) => n.type === "stage").map((n) => n.name);
      w.objects = [];
    }
  }
  if (!cfg.templateCatalog?.commercialTracker) {
    if (!cfg.workflows.some(w => w.id === Tracker.id)) cfg.workflows.push(Tracker.create());
    const commercial = cfg.projectTypes?.find(t => t.id === 'commercial');
    if(commercial?.workflowId === 'commercial') commercial.workflowId = Tracker.id;
    cfg.templateCatalog = {...cfg.templateCatalog, commercialTracker: 1};
  }
  return cfg;
}
function validate(w) {
  const nodes = nodesFor(w);
  if (nodes.length > 200 || !nodes.length)
    return "Workflow must contain 1–200 objects";
  for (const n of nodes) {
    const fieldError = F.validateSchema(n);
    if (fieldError) return fieldError;
    if (
      n.parallelWithPrevious !== undefined &&
      typeof n.parallelWithPrevious !== "boolean"
    )
      return "Parallel setting must be boolean";
    for (const [key, max] of [
      ["requiredFields", 30],
      ["taskTemplates", 50],
    ])
      if (
        n[key] !== undefined &&
        (!Array.isArray(n[key]) ||
          n[key].length > max ||
          n[key].some(
            (v) => typeof v !== "string" || !v.trim() || v.length > 200,
          ) ||
          new Set(n[key]).size !== n[key].length)
      )
        return "Invalid " + key;
  }
  return "";
}
function create(w, userId) {
  const nodes = nodesFor(w);
  return {
    workflowId: w.id,
    name: w.name,
    version: crypto
      .createHash("sha256")
      .update(JSON.stringify(nodes))
      .digest("hex")
      .slice(0, 12),
    createdAt: new Date().toISOString(),
    createdById: userId,
    schemaVersion: 3,
    revision: 1,
    nodes,
    states: Object.fromEntries(
      nodes.map((n) => [n.id, { status: "Pending", values: {}, history: [] }]),
    ),
  };
}
function groups(instance, parent) {
  const result = [];
  for (const n of instance.nodes.filter(
    (n) => (n.parent || "") === (parent || ""),
  )) {
    if (!result.length || !n.parallelWithPrevious) result.push([]);
    result.at(-1).push(n);
  }
  return result;
}
function refresh(instance) {
  function visit(parent, enabled) {
    let priorDone = true;
    for (const group of groups(instance, parent)) {
      const available = enabled && priorDone;
      for (const n of group) {
        const state = instance.states[n.id];
        if (state.status !== "Completed") {
          state.status = available ? "In progress" : "Pending";
          if (available) state.startedAt ||= new Date().toISOString();
        }
        visit(n.id, available && state.status !== "Completed");
      }
      priorDone =
        priorDone &&
        group.every((n) => instance.states[n.id].status === "Completed");
    }
  }
  visit("", true);
  return instance;
}
function isLead(p, user) {
  return (
    user.profileId === "prof-admin" ||
    [p.managerId, p.supervisorId].includes(user.id)
  );
}
function access(instance, node, p, user, ps) {
  if (!node) return "hidden";
  if (user.profileId === "prof-admin") return "approve";
  let current = node,
    level;
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    const rule = current.permissions?.[user.profileId];
    if (rule === "hidden") return "hidden";
    if (level === undefined && rule !== undefined) level = rule;
    current = instance.nodes.find((n) => n.id === current.parent);
  }
  return (
    level ||
    (isLead(p, user) && ps.assignTasks
      ? "approve"
      : ps.assignTasks
        ? "edit"
        : "view")
  );
}
function canRead(db, p, user, ps, nodeId) {
  const instance = db.projectWorkflows?.[p.id];
  return (
    !!instance &&
    access(
      instance,
      instance.nodes.find((n) => n.id === nodeId),
      p,
      user,
      ps,
    ) !== "hidden"
  );
}
function canUpdateTask(db, p, user, ps, t) {
  const instance = db.projectWorkflows?.[p.id];
  if (!instance || !t.workflowNodeId) return true;
  const node = instance.nodes.find((n) => n.id === t.workflowNodeId);
  if (
    !node ||
    !canRead(db, p, user, ps, node.id) ||
    instance.states[node.id].status !== "In progress"
  )
    return false;
  if (user.profileId === "prof-admin") return true;
  if (ACCESS.indexOf(access(instance, node, p, user, ps)) >= 2) return true;
  let cur = node;
  while (cur) {
    if (cur.permissions?.[user.profileId] !== undefined) return false;
    cur = instance.nodes.find((n) => n.id === cur.parent);
  }
  return !editError(db, p, user, ps, node.id) || t.assignee === user.name;
}
function canPlanTask(db, p, user, ps, t) {
  if (!ps.assignTasks) return false;
  if (!t.workflowNodeId) return true;
  const instance = db.projectWorkflows?.[p.id];
  const node = instance?.nodes.find(n => n.id === t.workflowNodeId);
  return !!node && instance.states[node.id].status !== 'Completed' &&
    ACCESS.indexOf(access(instance, node, p, user, ps)) >= 2;
}
function editError(db, p, user, ps, nodeId) {
  const instance = db.projectWorkflows?.[p.id],
    node = instance?.nodes.find((n) => n.id === nodeId);
  if (!node || ACCESS.indexOf(access(instance, node, p, user, ps)) < 2)
    return "Workflow object edit permission required";
  refresh(instance);
  if (instance.states[nodeId].status !== "In progress")
    return "Workflow object is locked or completed";
  return "";
}
function blockers(db, p, instance, node) {
  const state = instance.states[node.id],
    result = [];
  if (
    instance.nodes.some(
      (n) =>
        n.parent === node.id && instance.states[n.id].status !== "Completed",
    )
  )
    result.push("Complete all child objects first");
  const tasks = db.tasks.filter(
    (t) =>
      t.projectId === p.id &&
      (t.workflowNodeId === node.id || (instance.workflowId === "commercial" && node.id === "execution")) &&
      Number(t.level || 3) >= 3,
  );
  if (tasks.some((t) => !["Completed","Not Required","Lost/Cancelled","No-Go (Client)","No-Go (DOA)","Lost (DOA)"].includes(t.status)))
    result.push("Complete all linked tasks first");
  if (node.completion === "tasks" && !tasks.length)
    result.push("Link at least one task");
  if (
    node.completion === "fields" &&
    !F.fieldsFor(node).some((f) => f.required)
  )
    result.push("Configure at least one required field");
  if (F.missingRequired(node, state, p))
    result.push("Fill all required fields");
  return result;
}
function requiresSignoff(instance, node) {
  return !node.parent || instance.nodes.some((n) => n.parent === node.id);
}
function namedLead(p, user) {
  return [p.managerId, p.supervisorId].includes(user.id);
}
function view(db, p, user, ps) {
  const instance = db.projectWorkflows?.[p.id];
  if (!instance) return null;
  refresh(instance);
  const visible = instance.nodes.filter(
    (n) => access(instance, n, p, user, ps) !== "hidden",
  );
  return {
    workflowId: instance.workflowId,
    name: instance.name,
    version: instance.version,
    revision: instance.revision,
    createdAt: instance.createdAt,
    completed: visible.filter(
      (n) => instance.states[n.id].status === "Completed",
    ).length,
    total: visible.length,
    isComplete: instance.nodes.every(
      (n) => instance.states[n.id].status === "Completed",
    ),
    nodes: visible.map((n) => {
      const level = access(instance, n, p, user, ps),
        state = instance.states[n.id];
      const blocked = blockers(db, p, instance, n);
      return {
        id: n.id,
        name: n.name,
        type: n.type,
        parent: n.parent,
        completion: n.completion,
        parallelWithPrevious: n.parallelWithPrevious,
        fields: F.visibleFields(n, p, ps),
        requiredFields: F.visibleFields(n, p, ps)
          .filter((f) => f.required)
          .map((f) => f.id),
        requiresSignoff: requiresSignoff(instance, n),
        ...structuredClone(state),
        values: Object.fromEntries(
          Object.entries(state.values || {}).filter(([id]) =>
            F.visibleFields(n, p, ps).some((f) => f.id === id),
          ),
        ),
        blockers: blocked,
        canPlan: !!ps.assignTasks && ACCESS.indexOf(level) >= 2 && state.status !== "Completed",
        canEdit: ACCESS.indexOf(level) >= 2 && state.status === "In progress",
        canComplete:
          (!requiresSignoff(instance, n) || namedLead(p, user)) &&
          isLead(p, user) &&
          (ps.assignTasks || user.profileId === "prof-admin") &&
          ACCESS.indexOf(level) >= 3 &&
          ((!["approval", "signoff"].includes(n.completion) &&
            !["approval", "signoff"].includes(n.type)) ||
            level === "approve" ||
            user.profileId === "prof-admin") &&
          state.status === "In progress" &&
          !blocked.length,
        canReopen:
          (!requiresSignoff(instance, n) || namedLead(p, user)) &&
          isLead(p, user) &&
          (ps.assignTasks || user.profileId === "prof-admin") &&
          ACCESS.indexOf(level) >= 3 &&
          state.status === "Completed",
        hours: (() => {
          const ids = new Set([n.id]);
          let added = true;
          while (added) { added = false; for (const child of instance.nodes) if (ids.has(child.parent) && !ids.has(child.id)) { ids.add(child.id); added = true; } }
          const tasks = db.tasks.filter(t => t.projectId === p.id && Number(t.level || 3) >= 3 && ids.has(t.workflowNodeId) && canRead(db, p, user, ps, t.workflowNodeId));
          return {estimate: tasks.reduce((v,t) => v + Number(t.mhEstimate || 0),0), actual: tasks.reduce((v,t) => v + Number(t.mhActual || 0),0)};
        })(),
        tasks: db.tasks
          .filter((t) => t.projectId === p.id && t.workflowNodeId === n.id)
          .map((t) => t.id),
      };
    }),
  };
}
function resetFrom(instance, node) {
  const reset = new Set();
  function descendants(id) {
    reset.add(id);
    for (const child of instance.nodes.filter((n) => n.parent === id))
      descendants(child.id);
  }
  descendants(node.id);
  let current = node;
  while (current) {
    const gs = groups(instance, current.parent);
    const index = gs.findIndex((g) => g.some((n) => n.id === current.id));
    reset.add(current.id);
    for (const group of gs.slice(index + 1))
      for (const n of group) descendants(n.id);
    current = instance.nodes.find((n) => n.id === current.parent);
  }
  for (const id of reset) {
    const state = instance.states[id];
    state.status = "Pending";
    delete state.completedAt;
    delete state.completedBy;
    delete state.startedAt;
    delete state.decision;
    delete state.signedOffBy;
    delete state.signedOffById;
    delete state.signedOffAt;
  }
  return reset;
}
function transition(db, p, user, ps, nodeId, b) {
  const instance = db.projectWorkflows[p.id],
    node = instance.nodes.find((n) => n.id === nodeId);
  if (!node || access(instance, node, p, user, ps) === "hidden")
    return { status: 404, error: "Workflow object not found" };
  if (b.expectedRevision !== instance.revision)
    return {
      status: 409,
      error: "Workflow changed. Refresh the project before trying again.",
    };
  const state = instance.states[nodeId],
    level = access(instance, node, p, user, ps),
    action = b.action;
  if (!["save", "complete", "signoff", "reopen", "reject"].includes(action))
    return { status: 422, error: "Invalid workflow action" };
  if (action === "save") {
    const error = editError(db, p, user, ps, nodeId);
    if (error) return { status: 403, error };
    if (b.values !== undefined) {
      const checked = F.validateValues(node, p, ps, b.values, db.users);
      if (checked.error)
        return { status: checked.status || 422, error: checked.error };
      Object.assign(p, checked.updates);
      if (Object.keys(checked.pricing).length)
        p.pricing = { ...(p.pricing || {}), ...checked.pricing };
      state.values = { ...state.values, ...b.values };
      state.history ||= [];
      state.history.push({
        action: "save",
        comment: "Updated object fields",
        user: user.name,
        userId: user.id,
        at: new Date().toISOString(),
      });
    }
  } else {
    if (
      !isLead(p, user) ||
      (!ps.assignTasks && user.profileId !== "prof-admin") ||
      ACCESS.indexOf(level) < 3
    )
      return {
        status: 403,
        error:
          "Only the assigned project manager or supervisor can complete project objects",
      };
    const parent = requiresSignoff(instance, node);
    if (parent && !namedLead(p, user))
      return {
        status: 403,
        error:
          "Parent sign-off requires the assigned project manager or supervisor, including for administrators",
      };
    if (parent && action === "complete")
      return {
        status: 422,
        error: "Every parent requires an explicit sign-off",
      };
    if (
      action === "signoff" &&
      !parent &&
      node.type !== "signoff" &&
      node.completion !== "signoff"
    )
      return { status: 422, error: "This object uses normal completion" };
    const reason = String(b.comment || "").trim();
    if (action === "signoff" && !reason)
      return { status: 422, error: "A sign-off comment is required" };
    if (reason.length > 3000)
      return { status: 422, error: "Comment must be at most 3000 characters" };
    if (action === "reopen") {
      if (state.status !== "Completed")
        return { status: 409, error: "Only completed objects can be reopened" };
      if (!reason) return { status: 422, error: "A reopen reason is required" };
      resetFrom(instance, node);
    } else {
      if (state.status !== "In progress")
        return { status: 409, error: "This object is locked or completed" };
      const approval =
        ["approval", "signoff"].includes(node.completion) ||
        ["approval", "signoff"].includes(node.type);
      if (approval && level !== "approve")
        return {
          status: 403,
          error: "Approve access is required for approval or sign-off",
        };
      if (approval && !reason)
        return {
          status: 422,
          error: "Enter an approval, sign-off or rejection comment",
        };
      if (action === "reject") {
        if (!approval || !reason)
          return {
            status: 422,
            error:
              "Only approvals and sign-offs can be rejected, with a reason",
          };
        state.decision = "Rejected";
      } else {
        const blocked = blockers(db, p, instance, node);
        if (blocked.length) return { status: 409, error: blocked.join(". ") };
        state.status = "Completed";
        state.completedAt = new Date().toISOString();
        state.completedBy = user.name;
        if (action === "signoff") {
          state.signedOffBy = user.name;
          state.signedOffById = user.id;
          state.signedOffAt = state.completedAt;
        }
        state.decision =
          action === "signoff"
            ? "Signed off"
            : approval
              ? node.type === "signoff" || node.completion === "signoff"
                ? "Signed off"
                : "Approved"
              : "Completed";
      }
    }
    state.history ||= [];
    state.history.push({
      action,
      comment: reason,
      user: user.name,
      userId: user.id,
      at: new Date().toISOString(),
    });
  }
  instance.revision++;
  refresh(instance);
  return { status: 200 };
}
module.exports = {
  LIFECYCLE,
  defaultConfig,
  upgradeConfig,
  nodesFor,
  validate,
  create,
  refresh,
  access,
  isLead,
  canRead,
  canUpdateTask,
  canPlanTask,
  editError,
  view,
  transition,
};
