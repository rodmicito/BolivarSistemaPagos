# Tailwind CSS & Dark Mode Guidelines

Always adhere to the following styling constraints when writing CSS/Tailwind classes for both light and dark themes:

## 1. Tailwind Color Scale Restraints
Tailwind CSS only supports specific numeric weight values for color hues:
* Standard scale: `50`, `100`, `200`, `300`, `400`, `500`, `600`, `700`, `800`, `900`, `950`.
* **DO NOT** invent custom color levels like `155`, `355`, `655`, `750`, `855`, or `955`. If a lighter or darker shade is needed, use opacity filters (e.g. `bg-slate-900/50`) or stick strictly to the standard steps.

## 2. Dark Mode Contrast Guidelines
To prevent low-contrast text on dark backgrounds:
* **Backgrounds:** Use `dark:bg-slate-950` or `dark:bg-slate-900` for main pages.
* **Containers/Cards:** Use `dark:bg-slate-800` or `dark:bg-slate-900/50` for cards.
* **Text Colors:**
  * Primary text: Use `dark:text-white` or `dark:text-slate-100`.
  * Secondary text: Use `dark:text-slate-300` or `dark:text-slate-400`.
  * Muted/Labels: Use `dark:text-slate-500`.
* **Form Inputs:**
  * Background: `dark:bg-slate-900` or `dark:bg-slate-900/40`.
  * Text color: Must always be `dark:text-white` or `dark:text-slate-100`.
  * Borders: Use `dark:border-slate-700` or `dark:border-slate-800`.
* **Hover States:** Use `dark:hover:bg-slate-700` instead of non-existent values.
