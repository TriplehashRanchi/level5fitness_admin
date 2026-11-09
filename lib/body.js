export const GOAL_LABEL = { lose: "Lose weight", maintain: "Stay at weight", gain: "Gain weight" };
export const SEX_LABEL = { female: "Female", male: "Male", other: "Other" };
export const DIET_LABEL = { vegetarian: "Vegetarian", non_vegetarian: "Non-vegetarian", eggetarian: "Eggetarian", vegan: "Vegan" };
export const ACTIVITY_LABEL = {
  sedentary: "Mostly sitting",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Very active",
  very_active: "Athlete",
};
export const SLOTS = ["breakfast", "lunch", "snack", "dinner", "supplement"];
export const SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", snack: "Snack", dinner: "Dinner", supplement: "Supplement" };

export const fmtKg = (kg) => `${parseFloat(Number(kg).toFixed(1))} kg`;

/** Body mass index, one decimal. */
export const bmi = (weightKg, heightCm) => {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
};

export function bmiBand(value) {
  if (value < 18.5) return { label: "Underweight", tone: "warn" };
  if (value < 25) return { label: "Healthy range", tone: "good" };
  if (value < 30) return { label: "Overweight", tone: "warn" };
  return { label: "Obese range", tone: "bad" };
}

/** How far along the member is toward their goal, 0 to 1. */
export function goalProgress(goal, start, current, target) {
  if (goal === "maintain") return Math.abs(current - target) <= 2 ? 1 : 0;
  const total = target - start;
  if (total === 0) return 1;
  return Math.min(1, Math.max(0, (current - start) / total));
}

export function goalRemaining(goal, current, target) {
  if (goal === "maintain") return Math.abs(current - target) <= 2 ? "On target" : `${fmtKg(Math.abs(current - target))} from target`;
  const left = goal === "lose" ? current - target : target - current;
  return left <= 0 ? "Goal reached" : `${fmtKg(left)} to ${goal}`;
}

/** Share of planned items that were ticked, as a whole percent, or null when nothing was planned. */
export const adherencePercent = (done, planned) => (planned ? Math.round((done / planned) * 100) : null);
