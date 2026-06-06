import path from "node:path";
import {
  buildTimestamp,
  flattenSurfaces,
  loadProviders,
  loadSubnets,
  repoRoot,
  writeJson
} from "./lib.mjs";

const providers = await loadProviders();
const subnets = await loadSubnets();
const surfaces = flattenSurfaces(subnets);
const outputRoot = path.join(repoRoot, "public/metagraph");
const generatedAt = buildTimestamp();

const subnetIndex = subnets.map((subnet) => ({
  categories: subnet.categories,
  dashboard_url: subnet.dashboard_url,
  docs_url: subnet.docs_url,
  name: subnet.name,
  netuid: subnet.netuid,
  slug: subnet.slug,
  source_repo: subnet.source_repo,
  status: subnet.status,
  surface_count: subnet.surfaces.length
}));

const metagraphLatest = {
  schema_version: 1,
  generated_at: generatedAt,
  source: "seed-manifests",
  notes: "Native Bittensor metagraph ingestion is not enabled yet. This file is a deterministic seed projection.",
  subnets: subnets.map((subnet) => ({
    categories: subnet.categories,
    name: subnet.name,
    netuid: subnet.netuid,
    slug: subnet.slug,
    status: subnet.status
  }))
};

const healthLatest = {
  schema_version: 1,
  generated_at: generatedAt,
  source: "artifact-build",
  notes: "Run npm run probes:smoke with METAGRAPH_WRITE_PROBE_RESULTS=1 to write live probe results.",
  surfaces: surfaces.map((surface) => ({
    auth_required: surface.auth_required,
    kind: surface.kind,
    method_tested: surface.probe?.method || "not-configured",
    provider: surface.provider,
    public_safe: surface.public_safe,
    status: "unknown",
    subnet_name: surface.subnet_name,
    subnet_slug: surface.subnet_slug,
    surface_id: surface.id,
    url: surface.url,
    verified_at: null
  }))
};

const adapterArtifacts = Object.fromEntries(
  subnets
    .filter((subnet) => subnet.extensions)
    .map((subnet) => [
      subnet.slug,
      {
        schema_version: 1,
        generated_at: generatedAt,
        netuid: subnet.netuid,
        subnet: subnet.name,
        slug: subnet.slug,
        extensions: subnet.extensions
      }
    ])
);

await writeJson(path.join(outputRoot, "providers.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  providers
});

await writeJson(path.join(outputRoot, "subnets.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  subnets: subnetIndex
});

await writeJson(path.join(outputRoot, "surfaces.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  surfaces
});

await writeJson(path.join(outputRoot, "metagraph/latest.json"), metagraphLatest);
await writeJson(path.join(outputRoot, "health/latest.json"), healthLatest);

for (const [slug, artifact] of Object.entries(adapterArtifacts)) {
  await writeJson(path.join(outputRoot, `adapters/${slug}.json`), artifact);
}

await writeJson(path.join(outputRoot, "build-summary.json"), {
  schema_version: 1,
  generated_at: generatedAt,
  adapter_count: Object.keys(adapterArtifacts).length,
  provider_count: providers.length,
  subnet_count: subnets.length,
  surface_count: surfaces.length
});

console.log(`Built ${subnets.length} subnet(s), ${surfaces.length} surface(s), and ${providers.length} provider(s).`);
