# AuraCare — Black Hair Chemistry, Face & Body Studio (v2.38)

- Fixes **Lookup** accuracy (`scoreProductNameMatch` & `enrichStashItemByName`):
  - Checks top 5 Open Beauty Facts candidates and requires at least 50% token match against your entered product name so unrelated items are never applied.
  - Preserves your exact entered product name and existing category unless a verified category is returned, and avoids guessing unrelated details in `mode: "product_name"`.
