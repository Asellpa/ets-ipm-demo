# Compatibility fixture

`legacy-seed.json` mirrors the shipped seed with an explicit optional-time policy. Existing regression scenarios use it to test compatibility with a company configuration that permits optional time. The shipped application defaults to mandatory recorded time or an authorised zero-hours approval. `task-completion-policy.test.cjs` and its browser journey use the shipped seed / required policy and verify all completion paths, roles and import validation. No test-mode bypass exists in application code.
