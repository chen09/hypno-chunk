# HypnoChunk Agent Handoff Notes

This file preserves high-signal project context so future agents can work safely and quickly.

## Source of Truth Policy

- This is the single source of truth (SSOT) for cross-cutting security/ops guardrails and agent handoff context.
- `README.md` and `DEPLOYMENT.md` may keep short operational summaries, but detailed policy should be updated here first.
- If content conflicts across docs, follow `AGENTS.md` and then sync the other docs.

## Read First

- `README.md` for project structure and workflow.
- `DEPLOYMENT.md` for production deployment details.
- `docker-compose.yml` for runtime security and logging constraints.

## Production Context (Critical)

- Host: Ubuntu 24.04 with Docker + Nginx reverse proxy.
- Domain: `https://hypnochunk.com`
- App container must NOT be exposed publicly on all interfaces.
  - Keep `3000` bound to loopback (`127.0.0.1:3000`) only.
  - Nginx is the public entrypoint.

## Security Incident Record

- A cryptocurrency miner (`xmrig`) was found running in a compromised runtime container.
- Root cause was treated as runtime/container hijack, not Docker Hub image poisoning.
- A major outage was caused by container logs growing too large and exhausting disk.
- Recovery actions included:
  - Replacing compromised container with clean image
  - Clearing oversized Docker logs / reclaiming disk
  - Hardening container runtime settings

## Guardrails (Do Not Remove Without Clear Reason)

- Keep Docker log rotation in `docker-compose.yml` (`max-size`, `max-file`).
- Keep hardening settings in `docker-compose.yml` (`read_only`, `security_opt`, dropped capabilities, resource limits).
- Avoid opening additional public ports.
- If any security hardening must be changed, document why in `README.md` and `DEPLOYMENT.md`.

## Data Provenance Requirement

When generating or updating audio outputs, keep these files updated:

- `data/2_audio_output/output_input_mapping.csv`
- `data/2_audio_output/output_input_mapping.md`

These files map generated output tracks to source input videos (YouTube URLs / IDs) and are required for traceability.

## Known Stability Follow-up

- There is a known stream-handling fix area in `web/app/api/audio/[...path]/route.ts` related to Node stream/Web stream compatibility.
- If audio streaming errors reappear, prioritize checking this route and validating production health checks.
