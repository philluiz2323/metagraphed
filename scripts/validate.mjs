import { loadProviders, loadSubnets, isValidUrl } from "./lib.mjs";

const providerKinds = new Set([
  "subnet-team",
  "infrastructure-provider",
  "docs-provider",
  "registry"
]);

const authorities = new Set([
  "official",
  "provider-claimed",
  "community",
  "registry-observed"
]);

const subnetStatuses = new Set(["active", "inactive", "unknown"]);

const surfaceKinds = new Set([
  "subtensor-rpc",
  "subtensor-wss",
  "subnet-api",
  "openapi",
  "sse",
  "dashboard",
  "repo-registry",
  "docs",
  "data-artifact"
]);

const probeMethods = new Set(["GET", "HEAD"]);
const probeExpectations = new Set(["json", "html", "sse", "any"]);

const slugPattern = /^[a-z0-9][a-z0-9-]*$/;

const errors = [];

function assert(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function validateProvider(provider) {
  assert(provider.schema_version === 1, `${provider.id || "provider"}: schema_version must be 1`);
  assert(slugPattern.test(provider.id || ""), `${provider.id || "provider"}: invalid provider id`);
  assert(Boolean(provider.name), `${provider.id}: name is required`);
  assert(providerKinds.has(provider.kind), `${provider.id}: invalid provider kind`);
  assert(isValidUrl(provider.website_url), `${provider.id}: website_url must be a URL`);
  if (provider.docs_url !== undefined) {
    assert(isValidUrl(provider.docs_url), `${provider.id}: docs_url must be a URL`);
  }
  assert(authorities.has(provider.authority), `${provider.id}: invalid authority`);
}

function validateSubnet(subnet, providerIds, surfaceIds) {
  assert(subnet.schema_version === 1, `${subnet.slug || "subnet"}: schema_version must be 1`);
  assert(Number.isInteger(subnet.netuid) && subnet.netuid >= 0, `${subnet.slug}: netuid must be a non-negative integer`);
  assert(Boolean(subnet.name), `${subnet.slug}: name is required`);
  assert(slugPattern.test(subnet.slug || ""), `${subnet.name || "subnet"}: invalid slug`);
  assert(subnetStatuses.has(subnet.status), `${subnet.slug}: invalid status`);
  assert(Array.isArray(subnet.categories), `${subnet.slug}: categories must be an array`);
  if (subnet.docs_url !== undefined) {
    assert(isValidUrl(subnet.docs_url), `${subnet.slug}: docs_url must be a URL`);
  }
  for (const key of ["source_repo", "dashboard_url"]) {
    if (subnet[key] !== undefined && subnet[key] !== null) {
      assert(isValidUrl(subnet[key]), `${subnet.slug}: ${key} must be a URL or null`);
    }
  }
  assert(Array.isArray(subnet.surfaces), `${subnet.slug}: surfaces must be an array`);

  for (const surface of subnet.surfaces || []) {
    const surfaceKey = `${subnet.slug}:${surface.id || "surface"}`;
    assert(slugPattern.test(surface.id || ""), `${surfaceKey}: invalid surface id`);
    assert(!surfaceIds.has(surface.id), `${surfaceKey}: duplicate global surface id`);
    surfaceIds.add(surface.id);
    assert(Boolean(surface.name), `${surfaceKey}: name is required`);
    assert(surfaceKinds.has(surface.kind), `${surfaceKey}: invalid kind`);
    assert(isValidUrl(surface.url), `${surfaceKey}: url must be a URL`);
    assert(providerIds.has(surface.provider), `${surfaceKey}: unknown provider ${surface.provider}`);
    assert(typeof surface.auth_required === "boolean", `${surfaceKey}: auth_required must be boolean`);
    assert(authorities.has(surface.authority), `${surfaceKey}: invalid authority`);
    assert(typeof surface.public_safe === "boolean", `${surfaceKey}: public_safe must be boolean`);

    if (surface.schema_url !== undefined) {
      assert(isValidUrl(surface.schema_url), `${surfaceKey}: schema_url must be a URL`);
    }

    if (surface.probe !== undefined) {
      assert(typeof surface.probe.enabled === "boolean", `${surfaceKey}: probe.enabled must be boolean`);
      assert(probeMethods.has(surface.probe.method), `${surfaceKey}: invalid probe.method`);
      assert(probeExpectations.has(surface.probe.expect), `${surfaceKey}: invalid probe.expect`);
      if (surface.probe.timeout_ms !== undefined) {
        assert(
          Number.isInteger(surface.probe.timeout_ms) &&
            surface.probe.timeout_ms >= 1000 &&
            surface.probe.timeout_ms <= 30000,
          `${surfaceKey}: probe.timeout_ms must be between 1000 and 30000`
        );
      }
    }
  }
}

const providers = await loadProviders();
const subnets = await loadSubnets();
const providerIds = new Set();
const netuids = new Set();
const slugs = new Set();
const surfaceIds = new Set();

for (const provider of providers) {
  validateProvider(provider);
  assert(!providerIds.has(provider.id), `${provider.id}: duplicate provider id`);
  providerIds.add(provider.id);
}

for (const subnet of subnets) {
  assert(!netuids.has(subnet.netuid), `${subnet.slug}: duplicate netuid ${subnet.netuid}`);
  assert(!slugs.has(subnet.slug), `${subnet.slug}: duplicate subnet slug`);
  netuids.add(subnet.netuid);
  slugs.add(subnet.slug);
  validateSubnet(subnet, providerIds, surfaceIds);
}

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} issue(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${providers.length} provider(s), ${subnets.length} subnet(s), and ${surfaceIds.size} surface(s).`);
