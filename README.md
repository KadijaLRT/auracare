# AuraCare — Blank-Slate Hair, Face & Body Studio (v2.14)

Fixes data wiping across app updates:
1. **Version-Agnostic Storage Slot (`STORAGE_KEY = "auracare_state_persistent"`):** Previous updates changed the `localStorage` key on every version bump (`v28`, `v29`, `v210`, `v212`, `v213`), which started each update from a blank slot instead of reading the previous version's saved data. `v2.14` uses a single permanent key and automatically migrates data from older version keys.
2. **Dual `localStorage` + `window.name` Persistence:** Saves to both `localStorage` and `window.name` on every change, and restores automatically if either is available.
3. **Copy / Restore Backup:** Adds **Copy Backup Code** and **Restore Backup** buttons on the saved profile summary card so you can also keep an external copy anytime.
