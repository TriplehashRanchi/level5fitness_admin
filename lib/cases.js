// Words and colours for cases and the member's journey stage. Shared by the Cases page, the client page and the client list.

export const SEVERITY = {
  urgent: { label: "Urgent", tone: "bad" },
  high: { label: "High", tone: "bad" },
  normal: { label: "Normal", tone: "warn" },
  low: { label: "Low", tone: "neutral" },
};

export const STATUS = {
  open: { label: "Open", tone: "warn" },
  assigned: { label: "Assigned", tone: "warn" },
  contacted: { label: "Contacted", tone: "good" },
  waiting: { label: "Waiting for reply", tone: "neutral" },
  escalated: { label: "Escalated", tone: "bad" },
  resolved: { label: "Resolved", tone: "good" },
};

export const OUTCOMES = [
  { value: "back_on_track", label: "Back on track" },
  { value: "plan_changed", label: "Plan changed" },
  { value: "no_response", label: "No response" },
  { value: "not_needed", label: "Not needed" },
  { value: "other", label: "Something else" },
];
export const OUTCOME_LABEL = { ...Object.fromEntries(OUTCOMES.map((o) => [o.value, o.label])), condition_cleared: "Cleared by itself" };

export const CHANNELS = [
  { value: "chat", label: "Chat" },
  { value: "call", label: "Phone call" },
  { value: "in_person", label: "In person" },
  { value: "other", label: "Something else" },
];
export const CHANNEL_LABEL = Object.fromEntries(CHANNELS.map((c) => [c.value, c.label]));

// The member's journey. "At risk" is the only one that asks for action.
export const STAGES = {
  new: { label: "New", tone: "neutral", hint: "Just joined and has not started yet." },
  activated: { label: "Getting started", tone: "good", hint: "Has begun, in their first two weeks." },
  active: { label: "Active", tone: "good", hint: "Following the plan." },
  at_risk: { label: "At risk", tone: "warn", hint: "Has gone quiet or is not following the plan." },
  paused: { label: "Paused", tone: "neutral", hint: "The plan is paused for illness, injury or a doctor's advice." },
  reactivated: { label: "Back again", tone: "good", hint: "Came back in the last two weeks." },
  maintenance: { label: "Maintaining", tone: "good", hint: "Reached the goal and keeping it." },
  churned: { label: "Gone quiet", tone: "bad", hint: "Nothing logged for a month or more." },
};
export const STAGE_ORDER = ["new", "activated", "active", "at_risk", "paused", "reactivated", "maintenance", "churned"];
