# Workspace Rules

- **Deployment Verification Rule**: Never declare a task as 'done' or inform the user that changes are live without explicitly verifying the production deployment first. Always check the deployment status (e.g., using GitHub or Vercel APIs) and ideally use the browser subagent to visually verify the live production URL. This applies to all UI and feature updates.
