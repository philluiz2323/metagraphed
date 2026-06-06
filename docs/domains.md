# Domain Plan

## Primary

`metagraph.sh`

Use this for the product, docs, static web UI, and generated registry artifacts.

Expected routes:

- `/`
- `/subnets`
- `/subnets/:netuid`
- `/providers`
- `/schemas`
- `/metagraph/subnets.json`
- `/metagraph/surfaces.json`
- `/metagraph/health/latest.json`

## Health Surface

`subnet.health`

Use this as a compact operational surface:

- `/7`
- `/74`
- `/badge/7.svg`
- `/badge/74.svg`
- `/api/subnets/7/status.json`
- `/api/subnets/74/status.json`

This domain should stay focused on probe results, status, badges, and health summaries. It can later become the entry point for hosted/load-balanced subnet access, but only after the registry proves useful.

## Copy Boundary

Use:

> Metagraphed extends the native Bittensor metagraph with public interface and health metadata.

Avoid:

> Metagraphed is the Bittensor metagraph.

The project is unofficial and must not imply OpenTensor/Bittensor endorsement.
