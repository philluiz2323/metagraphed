// CSV export tests for GET /api/v1/subnets/{netuid}/performance/history and
// GET /api/v1/subnets/{netuid}/hyperparameters/history — kept in a dedicated
// file so this PR does not contend with open entity-handler PRs on the shared
// request-handlers-entities.test.mjs harness (mirrors
// subnet-yield-history-csv.test.mjs / subnet-concentration-history-csv.test.mjs).

import assert from "node:assert/strict";
import { describe, test } from "vitest";
import { buildOpenApiArtifact } from "../src/contracts.mjs";
import { loadOpenApiComponentSchemas } from "../scripts/openapi-components.mjs";
import {
  canonicalSubnetPerformanceHistoryCachePath,
  handleSubnetHyperparamsHistory,
  handleSubnetPerformanceHistory,
} from "../workers/request-handlers/entities.mjs";

const NETUID = 7;

function req(path) {
  return new Request(`https://api.metagraph.sh${path}`);
}

function url(path) {
  return new URL(`https://api.metagraph.sh${path}`);
}

async function errorJson(res) {
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.ok, false);
  return body;
}

const PERFORMANCE_HISTORY_CSV_HEADER =
  "snapshot_date,neuron_count,validator_count,active_count,incentive_gini,incentive_nakamoto_coefficient,incentive_top_10pct_share,dividends_gini,dividends_nakamoto_coefficient,dividends_top_10pct_share,trust_mean,trust_median,consensus_mean,consensus_median,validator_trust_mean,validator_trust_median";

const HYPERPARAMS_HISTORY_CSV_HEADER =
  "block_number,observed_at,hyperparams_hash,kappa_ratio,immunity_period,min_allowed_weights,max_weight_limit_ratio,tempo,weights_version,weights_rate_limit,activity_cutoff,activity_cutoff_factor,registration_allowed,target_regs_per_interval,min_burn_tao,max_burn_tao,burn_half_life,burn_increase_mult,bonds_moving_avg_raw,max_regs_per_block,serving_rate_limit,max_validators,commit_reveal_period,commit_reveal_enabled,alpha_high_ratio,alpha_low_ratio,liquid_alpha_enabled,alpha_sigmoid_steepness,yuma_version,subnet_is_active,transfers_enabled,bonds_reset_enabled,user_liquidity_enabled,owner_cut_enabled,owner_cut_auto_lock_enabled,min_childkey_take_ratio";

describe("subnet performance/hyperparameters history OpenAPI CSV contract", () => {
  test("documents the CSV header on the performance/history route", async () => {
    const openapi = buildOpenApiArtifact(
      "1970-01-01T00:00:00.000Z",
      await loadOpenApiComponentSchemas(),
    );
    const csvContent =
      openapi.paths["/api/v1/subnets/{netuid}/performance/history"].get
        .responses["200"].content["text/csv"];
    assert.equal(csvContent.schema.type, "string");
    assert.equal(
      csvContent.example.split("\r\n")[0],
      PERFORMANCE_HISTORY_CSV_HEADER,
    );
  });

  test("documents the CSV header on the hyperparameters/history route", async () => {
    const openapi = buildOpenApiArtifact(
      "1970-01-01T00:00:00.000Z",
      await loadOpenApiComponentSchemas(),
    );
    const csvContent =
      openapi.paths["/api/v1/subnets/{netuid}/hyperparameters/history"].get
        .responses["200"].content["text/csv"];
    assert.equal(csvContent.schema.type, "string");
    assert.equal(
      csvContent.example.split("\r\n")[0],
      HYPERPARAMS_HISTORY_CSV_HEADER,
    );
  });
});

describe("handleSubnetPerformanceHistory CSV export", () => {
  test("returns header-only CSV when D1 is cold", async () => {
    const res = await handleSubnetPerformanceHistory(
      req(`/api/v1/subnets/${NETUID}/performance/history`),
      {},
      NETUID,
      url(
        `/api/v1/subnets/${NETUID}/performance/history?window=30d&format=csv`,
      ),
    );
    assert.equal(res.status, 200);
    const lines = (await res.text()).split("\r\n");
    assert.equal(lines[0], PERFORMANCE_HISTORY_CSV_HEADER);
    assert.equal(lines.length, 1);
  });

  test("sorts and exports real points ascending by snapshot_date via the Postgres tier", async () => {
    const env = {
      METAGRAPH_NEURONS_SOURCE: "postgres",
      DATA_API: {
        fetch: async () =>
          Response.json({
            schema_version: 1,
            netuid: NETUID,
            window: "30d",
            points: [
              {
                snapshot_date: "2026-06-21",
                neuron_count: 5,
                validator_count: 2,
                active_count: 5,
                incentive_gini: 0.4,
                incentive_nakamoto_coefficient: 2,
                incentive_top_10pct_share: 0.5,
                dividends_gini: 0.3,
                dividends_nakamoto_coefficient: 1,
                dividends_top_10pct_share: 1,
                trust_mean: 0.8,
                trust_median: 0.8,
                consensus_mean: 0.7,
                consensus_median: 0.7,
                validator_trust_mean: 0.9,
                validator_trust_median: 0.9,
              },
              {
                snapshot_date: "2026-06-20",
                neuron_count: 4,
                validator_count: 2,
                active_count: 4,
                incentive_gini: 0.35,
                incentive_nakamoto_coefficient: 2,
                incentive_top_10pct_share: 0.45,
                dividends_gini: 0.25,
                dividends_nakamoto_coefficient: 1,
                dividends_top_10pct_share: 1,
                trust_mean: 0.75,
                trust_median: 0.75,
                consensus_mean: 0.65,
                consensus_median: 0.65,
                validator_trust_mean: 0.85,
                validator_trust_median: 0.85,
              },
            ],
          }),
      },
    };
    const res = await handleSubnetPerformanceHistory(
      req(`/api/v1/subnets/${NETUID}/performance/history`),
      env,
      NETUID,
      url(
        `/api/v1/subnets/${NETUID}/performance/history?window=30d&format=csv`,
      ),
    );
    assert.equal(res.status, 200);
    const lines = (await res.text()).trim().split("\r\n");
    assert.equal(lines.length, 3);
    // CSV export re-sorts newest-first `points` into ascending snapshot_date.
    assert.match(lines[1], /^2026-06-20,/);
    assert.match(lines[2], /^2026-06-21,/);
  });

  test("rejects an unsupported format value", async () => {
    const res = await handleSubnetPerformanceHistory(
      req(`/api/v1/subnets/${NETUID}/performance/history`),
      {},
      NETUID,
      url(
        `/api/v1/subnets/${NETUID}/performance/history?window=30d&format=pdf`,
      ),
    );
    const body = await errorJson(res);
    assert.equal(body.meta.parameter, "format");
  });

  test("rejects an empty format parameter", async () => {
    const res = await handleSubnetPerformanceHistory(
      req(`/api/v1/subnets/${NETUID}/performance/history`),
      {},
      NETUID,
      url(`/api/v1/subnets/${NETUID}/performance/history?format=`),
    );
    const body = await errorJson(res);
    assert.equal(body.meta.parameter, "format");
  });
});

describe("canonicalSubnetPerformanceHistoryCachePath", () => {
  test("default window stays canonical for JSON", () => {
    assert.equal(
      canonicalSubnetPerformanceHistoryCachePath(
        url(`/api/v1/subnets/${NETUID}/performance/history`),
      ),
      `/api/v1/subnets/${NETUID}/performance/history?window=30d`,
    );
  });

  test("explicit CSV and JSON format overrides produce distinct cache variants", () => {
    const csv = canonicalSubnetPerformanceHistoryCachePath(
      url(`/api/v1/subnets/${NETUID}/performance/history?window=7d&format=csv`),
    );
    assert.equal(
      csv,
      `/api/v1/subnets/${NETUID}/performance/history?window=7d&format=csv`,
    );

    const csvAccept = new Request(
      `https://api.metagraph.sh/api/v1/subnets/${NETUID}/performance/history`,
      { headers: { accept: "text/csv" } },
    );
    const json = canonicalSubnetPerformanceHistoryCachePath(
      url(
        `/api/v1/subnets/${NETUID}/performance/history?window=7d&format=json`,
      ),
      csvAccept,
    );
    assert.equal(
      json,
      `/api/v1/subnets/${NETUID}/performance/history?window=7d`,
    );
  });

  test("adds format=csv when only Accept: text/csv is present", () => {
    const csvAccept = new Request(
      `https://api.metagraph.sh/api/v1/subnets/${NETUID}/performance/history`,
      { headers: { accept: "text/csv" } },
    );
    assert.equal(
      canonicalSubnetPerformanceHistoryCachePath(
        url(`/api/v1/subnets/${NETUID}/performance/history?window=90d`),
        csvAccept,
      ),
      `/api/v1/subnets/${NETUID}/performance/history?window=90d&format=csv`,
    );
  });

  test("falls back to raw search on unknown query param", () => {
    const raw = `/api/v1/subnets/${NETUID}/performance/history?bogus=1`;
    assert.equal(canonicalSubnetPerformanceHistoryCachePath(url(raw)), raw);
  });

  test("falls back to raw search on invalid format", () => {
    const raw = `/api/v1/subnets/${NETUID}/performance/history?format=pdf`;
    assert.equal(canonicalSubnetPerformanceHistoryCachePath(url(raw)), raw);
  });

  test("falls back to raw search on invalid window", () => {
    const raw = `/api/v1/subnets/${NETUID}/performance/history?window=1y`;
    assert.equal(canonicalSubnetPerformanceHistoryCachePath(url(raw)), raw);
  });
});

const HYPERPARAMS_ROW = {
  block_number: 8454388,
  observed_at: "2026-06-27T00:00:00.000Z",
  hyperparams_hash: "a1b2c3d4e5f6",
  hyperparameters: {
    kappa_ratio: 0.18,
    immunity_period: 4096,
    min_allowed_weights: 1,
    max_weight_limit_ratio: 1,
    tempo: 99,
    weights_version: 0,
    weights_rate_limit: 0,
    activity_cutoff: 5000,
    activity_cutoff_factor: 0,
    registration_allowed: true,
    target_regs_per_interval: 1,
    min_burn_tao: 0.001,
    max_burn_tao: 0.01,
    burn_half_life: 0,
    burn_increase_mult: 1.5,
    bonds_moving_avg_raw: 0,
    max_regs_per_block: 1,
    serving_rate_limit: 50,
    max_validators: 64,
    commit_reveal_period: 0,
    commit_reveal_enabled: false,
    alpha_high_ratio: 0.3,
    alpha_low_ratio: 0.1,
    liquid_alpha_enabled: false,
    alpha_sigmoid_steepness: null,
    yuma_version: 1,
    subnet_is_active: true,
    transfers_enabled: true,
    bonds_reset_enabled: false,
    user_liquidity_enabled: false,
    owner_cut_enabled: false,
    owner_cut_auto_lock_enabled: false,
    min_childkey_take_ratio: 0.1,
  },
};

describe("handleSubnetHyperparamsHistory CSV export", () => {
  test("returns header-only CSV when Postgres is unconfigured", async () => {
    const res = await handleSubnetHyperparamsHistory(
      req(`/api/v1/subnets/${NETUID}/hyperparameters/history`),
      {},
      NETUID,
      url(`/api/v1/subnets/${NETUID}/hyperparameters/history?format=csv`),
    );
    assert.equal(res.status, 200);
    const lines = (await res.text()).split("\r\n");
    assert.equal(lines[0], HYPERPARAMS_HISTORY_CSV_HEADER);
    assert.equal(lines.length, 1);
  });

  test("flattens each entry's nested hyperparameters into one CSV row via the Postgres tier", async () => {
    const env = {
      METAGRAPH_SUBNET_HYPERPARAMS_SOURCE: "postgres",
      DATA_API: {
        fetch: async () =>
          Response.json({
            schema_version: 1,
            netuid: NETUID,
            entry_count: 1,
            limit: 25,
            offset: 0,
            next_cursor: null,
            entries: [HYPERPARAMS_ROW],
          }),
      },
    };
    const res = await handleSubnetHyperparamsHistory(
      req(`/api/v1/subnets/${NETUID}/hyperparameters/history`),
      env,
      NETUID,
      url(`/api/v1/subnets/${NETUID}/hyperparameters/history?format=csv`),
    );
    assert.equal(res.status, 200);
    const lines = (await res.text()).trim().split("\r\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[0], HYPERPARAMS_HISTORY_CSV_HEADER);
    assert.equal(
      lines[1],
      "8454388,2026-06-27T00:00:00.000Z,a1b2c3d4e5f6,0.18,4096,1,1,99,0,0,5000,0,true,1,0.001,0.01,0,1.5,0,1,50,64,0,false,0.3,0.1,false,,1,true,true,false,false,false,false,0.1",
    );
  });

  test("rejects an unsupported format value", async () => {
    const res = await handleSubnetHyperparamsHistory(
      req(`/api/v1/subnets/${NETUID}/hyperparameters/history`),
      {},
      NETUID,
      url(`/api/v1/subnets/${NETUID}/hyperparameters/history?format=pdf`),
    );
    const body = await errorJson(res);
    assert.equal(body.meta.parameter, "format");
  });

  test("rejects an empty format parameter", async () => {
    const res = await handleSubnetHyperparamsHistory(
      req(`/api/v1/subnets/${NETUID}/hyperparameters/history`),
      {},
      NETUID,
      url(`/api/v1/subnets/${NETUID}/hyperparameters/history?format=`),
    );
    const body = await errorJson(res);
    assert.equal(body.meta.parameter, "format");
  });
});
