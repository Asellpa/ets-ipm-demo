# Appearance preferences

Preferences in the application header offers Light, Dark and Device. Device is the default for existing and new accounts. It follows `prefers-color-scheme` live. Explicit choices override device changes. Sign-out returns to device appearance so the next user does not inherit the previous account's choice.

The authenticated `/api/preferences` GET/PATCH endpoint reads and updates only the current account. PATCH accepts exactly `{appearance: "light" | "dark" | "system"}`; no target user or role is accepted. No administration permission is required. The existing JSON or PostgreSQL persistence path stores preferences with the user; bootstrap returns only the current user's preference. No password, workflow, project data or permission is changed.

`appearance.css` owns the light/dark palette and native `color-scheme`. Existing layout colours are tokenised in `styles.css`, preserving light-mode values. Status/priority components use shared tone tokens, including native select options. Typography remains in `typography.css`; no filter/inversion is applied to screenshots or uploaded documents. The navy sidebar and teal primary action stay consistent between themes.

Account preferences are fetched on sign-in rather than copied through shared browser storage. The sign-in/loading screen uses the device theme. Scope is appearance and colour consistency; project/workflow interactions and layout remain compatible with the existing application.

Validation covers account isolation and server restart, rejected payloads/unauthenticated requests, device changes, explicit overrides, reload persistence, save failures, primary screens, project dialog, narrow-screen preferences, contrast sampling and the existing regression suite. Contrast sampling is not a substitute for a comprehensive accessibility audit.
