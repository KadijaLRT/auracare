# AuraCare — Black Hair Chemistry, Face & Body Studio (v2.58.0)

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
- The routine screen uses relevant Stash products only within matching care steps; it does not render a separate owned-products inventory section.
- Manual entries and phone-scanned entries both persist in the same inventory and display their source. Scanning an existing manual item preserves both entry methods.
- Fixed inventory serialization sent to the routine API: product name, category, domain, brand, notes, and entry method are now included (previously the API received abbreviated keys and could not reliably match stash items).
- Failed scans now report the scan error rather than redirecting to unrelated shopping recommendations.
- Updated the service-worker cache version so deployed clients fetch the new app.


## Version 2.51 routine / stash ownership behavior
- My Stash is the single source of truth for products the user owns, whether added manually or scanned by phone.
- Routines show care steps and usage guidance without a separate inventory list. The exact matching product may be identified within its relevant step.
- Routine missing-product recommendations are filtered against Stash so an owned item is never recommended for purchase again.
- Only genuinely missing products appear under Recommended Store Picks.


## v2.52.0 updates
- Permanently removed the “Your products considered for this routine” section from the routine renderer. Owned products remain in My Stash and are assigned only to relevant routine steps.
- Routine rendering now uses the generated concern-specific routine steps, while enforcing that unselected domains stay hidden.
- Routine generation and store recommendations now receive the saved profile plus the current/saved Check-In note, selected triggers, hair state, and styling method.
- Fallback recommendations are limited to domains supported by selected profile concerns or Check-In signals, and exclude products already in Stash.


## v2.57 personalized fragrance profile
- Added a saved fragrance profile with scent families, preferred notes, wear occasions, projection preference, favorite fragrances, and scent dislikes.
- Added a per-fragrance budget selector with a hard maximum-price filter for fragrance recommendations.
- Fragrance matches prioritize Burlington Coat Factory, Scentbird, Bath & Body Works, and Amazon.
- Recommendations display scent family, notes, fragrance format, and intended wear profile when returned by the recommendation service.
- Prices are estimates and retailer availability is not live-verified; Amazon seller authenticity should be checked before purchase.
- Fragrance recommendations are separate from hair/skin treatment routines and are not forced into brand-set completion logic.


Version 2.57 builds a fragrance preference profile from the perfumes and body mists saved in My Stash. It refreshes after fragrance items are added, scanned, edited, looked up, or removed, and feeds the inferred scent families and notes into fragrance recommendations alongside manually selected preferences.


## Version 2.59 — strict hair / face / body product-domain isolation
- Routine product matching now uses explicit stash categories and domain consistency; generic words such as “oil”, “cream”, “lotion”, or “cleanser” cannot move a product between care domains.
- A product with conflicting domain/category metadata is treated as unclassified and cannot be assigned to a routine step. Unknown scan results remain unclassified rather than defaulting to hair.
- Hair, face, and body steps accept only their own category-specific product roles; a product in the same domain but the wrong role is not substituted.
- The AI routine response is revalidated in the browser before display, and store picks are matched by both domain and category role.
- Removed the unsafe “first product in this domain” fallback that could place a face serum into a face-cleansing step or an unrelated item into hair/body care.
- Bumped the service-worker cache to v2.59.
- Offline/local routine fallback now follows the same concern-selected domains as the normal routine renderer; it no longer generates all three care routines by default.
- Ambiguous generic “Moisturizer” scan results are not guessed into face/body care; hair-specific scans should use “Hair Moisturizer”, while face and body use their explicit categories.
- Ambiguous generic “Moisturizer” scan results are not guessed into face/body care; use “Hair Moisturizer”, “Face Moisturizer”, or a body-specific category.