# AuraCare — Black Hair Chemistry, Face & Body Studio (v2.50)

## Recommendation standards
- Recommendations are tailored to textured/Black hair, scalp care, and melanin-rich skin using profile, routine, sensitivity, chemical/color history, styling, climate, and stash context.
- Product budget is a **per-product ceiling**. Complete-set totals are displayed separately so users can judge the full cost.
- If a recommendation triggers a known brand system, AuraCare includes every member of that system in the same recommendation group, marking products already owned. It suppresses a partial set when any missing set member exceeds the user's per-product cap.
- Recommendations should avoid redundant steps and incompatible or unnecessarily irritating active-ingredient combinations. Where ingredients need separation, the plan should state an AM/PM or alternating-day schedule.
- Melanin-rich skin guidance prioritizes barrier support, daily broad-spectrum SPF 30+, and cautious approaches to post-inflammatory hyperpigmentation; it must not promise skin bleaching or diagnosis.
- Hair guidance accounts for porosity, chemical/color processing, heat, traction, protective styles, and scalp health. It must not recommend overlapping relaxer/bleach or tight styles.

## Version 2.46 changes
- Added complete-brand-system enforcement to local and AI-powered shopping recommendations.
- Added owned-item labels, full-set completion cost, and set grouping metadata.
- Changed the budget label to clarify that the slider is a per-product maximum.
- Updated AI shopping and routine guidance for Black hair and melanin-rich skin, product layering, and active-ingredient compatibility.

## Run
- `npm install`
- Set `GROQ_API_KEY` in your Vercel environment.
- `npm run dev`


## v2.47 recommendation behavior
- Product fit and routines for the user-selected hair, skin, and body concerns take priority over price.
- Saved price preferences are not hard filters; prices are informational.
- Complete named product systems are shown in full, including items already owned.
- Routine recommendations should explain product purpose, order, frequency, and compatibility.


## Version 2.48 changes
- Each product recommendation now has a dedicated “Why this product was selected” explanation using the recommendation's product-fit rationale.
- Recommendation cards also show the profile concerns selected for that product's domain (hair, face skin, or body), making the personalization visible.
- If a recommendation has no explicit rationale, the interface uses a transparent fallback rather than inventing ingredient or clinical benefits.


## Version 2.50 routine and stash fixes
- Rebuilt the displayed routine from the actual selected hair, face, and body concerns; unrelated domains are hidden rather than filled with generic steps.
- Routine steps now use only stash items whose category matches the step. If no matching owned item exists, the UI says it is missing and attaches a returned recommendation only when its domain and product role match.
- The routine screen now visibly lists all stash products relevant to the selected domains.
- Manual entries and phone-scanned entries both persist in the same inventory and display their source. Scanning an existing manual item preserves both entry methods.
- Fixed inventory serialization sent to the routine API: product name, category, domain, brand, notes, and entry method are now included (previously the API received abbreviated keys and could not reliably match stash items).
- Failed scans now report the scan error rather than redirecting to unrelated shopping recommendations.
- Updated the service-worker cache version so deployed clients fetch the new app.
