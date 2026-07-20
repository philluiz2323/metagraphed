// Coverage-depth list loader for GraphQL/MCP parity on GET /api/v1/coverage-depth.
// Applies the same list-query transforms as the REST route over the baked
// /metagraph/coverage-depth.json artifact (data_key "rows"). Distinct from
// list_enrichment_targets (mcp-server.mjs), which reshapes the same artifact
// into a curated ranked-queue view rather than mirroring REST's generic
// filter/sort/page contract 1:1.

import { applyQueryFilters } from "../workers/list-query.mjs";
import { API_QUERY_COLLECTIONS, QUERY_ENUMS } from "./contracts.mjs";

export const COVERAGE_DEPTH_ARTIFACT = "/metagraph/coverage-depth.json";

const COVERAGE_DEPTH_SORT_FIELDS =
  API_QUERY_COLLECTIONS["coverage-depth"].sort_fields;
const COVERAGE_DEPTH_TIERS = QUERY_ENUMS.coverageDepthTier;
const AGENT_READINESS_STATUSES = QUERY_ENUMS.agentReadinessStatus;
const AGENT_BLOCKER_LEVELS = QUERY_ENUMS.agentBlockerLevel;

export function coverageDepthMcpError(code, message) {
  const error = new Error(message);
  error.toolError = true;
  error.code = code;
  return error;
}

function optionalString(args, key) {
  const value = args?.[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw coverageDepthMcpError(
      "invalid_params",
      `Argument \`${key}\` must be a non-empty string when provided.`,
    );
  }
  return value.trim();
}

function optionalEnum(args, key, allowed) {
  const value = args?.[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw coverageDepthMcpError(
      "invalid_params",
      `Argument \`${key}\` must be one of: ${allowed.join(", ")}.`,
    );
  }
  return value;
}

export function coverageDepthQueryUrl(args) {
  const url = new URL("https://mcp.internal/coverage-depth");
  if (args?.netuid !== undefined) {
    if (!Number.isInteger(args.netuid) || args.netuid < 0) {
      throw coverageDepthMcpError(
        "invalid_params",
        "netuid must be a non-negative integer.",
      );
    }
    url.searchParams.set("netuid", String(args.netuid));
  }
  const tier = optionalEnum(args, "tier", COVERAGE_DEPTH_TIERS);
  if (tier) url.searchParams.set("tier", tier);
  const agentStatus = optionalEnum(
    args,
    "agent_status",
    AGENT_READINESS_STATUSES,
  );
  if (agentStatus) url.searchParams.set("agent_status", agentStatus);
  const blockerLevel = optionalEnum(
    args,
    "blocker_level",
    AGENT_BLOCKER_LEVELS,
  );
  if (blockerLevel) url.searchParams.set("blocker_level", blockerLevel);
  const q = optionalString(args, "q");
  if (q) url.searchParams.set("q", q);
  const sort = optionalEnum(args, "sort", COVERAGE_DEPTH_SORT_FIELDS);
  if (sort) url.searchParams.set("sort", sort);
  const order = optionalEnum(args, "order", ["asc", "desc"]);
  if (order) url.searchParams.set("order", order);
  const fields = optionalString(args, "fields");
  if (fields) url.searchParams.set("fields", fields);
  if (args?.limit !== undefined) {
    if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100) {
      throw coverageDepthMcpError(
        "invalid_params",
        "limit must be an integer between 1 and 100.",
      );
    }
    url.searchParams.set("limit", String(args.limit));
  }
  if (args?.cursor !== undefined) {
    if (!Number.isInteger(args.cursor) || args.cursor < 0) {
      throw coverageDepthMcpError(
        "invalid_params",
        "cursor must be a non-negative integer.",
      );
    }
    url.searchParams.set("cursor", String(args.cursor));
  }
  return url;
}

export async function loadCoverageDepthList(ctx, args, { readArtifact } = {}) {
  const queryUrl = coverageDepthQueryUrl(args);
  const read = readArtifact ?? ctx.readArtifact;
  const result = await read(ctx.env, COVERAGE_DEPTH_ARTIFACT);
  if (!result?.ok) {
    const code = result?.code || "artifact_unavailable";
    if (code === "artifact_not_found") {
      throw coverageDepthMcpError(
        "not_found",
        "Coverage-depth scorecard unavailable.",
      );
    }
    throw coverageDepthMcpError(
      code,
      `Could not load ${COVERAGE_DEPTH_ARTIFACT} (${code}).`,
    );
  }
  const blob = result.data;
  if (!blob || typeof blob !== "object") {
    throw coverageDepthMcpError(
      "not_found",
      "Coverage-depth scorecard unavailable.",
    );
  }
  const transformed = applyQueryFilters(blob, queryUrl, "coverage-depth", []);
  if (transformed.error) {
    throw coverageDepthMcpError("invalid_params", transformed.error.message);
  }
  const { data, meta } = transformed;
  const page = meta.pagination || {};
  const rows = Array.isArray(data.rows) ? data.rows : [];
  const rowLen = rows.length;
  return {
    generated_at: data.generated_at ?? null,
    coverage_depth_version: data.coverage_depth_version ?? null,
    rows,
    total: page.total ?? rowLen,
    returned: page.returned ?? rowLen,
    limit: page.limit ?? rowLen,
    cursor: page.cursor ?? 0,
    next_cursor: page.next_cursor ?? null,
    sort: page.sort ?? null,
    order: page.order ?? null,
  };
}

export const LIST_COVERAGE_DEPTH_INSTRUCTIONS =
  "list_coverage_depth the raw per-subnet coverage-depth scorecard rows " +
  "(tier, agent_status, blocker_level, priority_score; mirrors GET " +
  "/api/v1/coverage-depth 1:1) -- distinct from list_enrichment_targets, " +
  "which reshapes the same data into a curated ranked-queue view, ";

export const LIST_COVERAGE_DEPTH_MCP_TOOL = {
  name: "list_coverage_depth",
  title: "List coverage-depth scorecard rows",
  description:
    "Fetch the raw per-subnet coverage-depth scorecard rows: tier, " +
    "agent_status, blocker_level, priority_score, and top gap codes for " +
    "every registered subnet. Filter by netuid, tier, agent_status, or " +
    "blocker_level; search by name/slug/gap codes/recommended action (q); " +
    "sort with sort + order; page with limit (1-100) / cursor. Mirrors GET " +
    "/api/v1/coverage-depth 1:1 -- use list_enrichment_targets instead for " +
    "the curated, ranked work-planning view of the same data.",
  inputSchema: {
    type: "object",
    properties: {
      netuid: {
        type: "integer",
        description: "Filter to one subnet netuid.",
        minimum: 0,
      },
      tier: {
        type: "string",
        enum: COVERAGE_DEPTH_TIERS,
        description: "Filter by coverage-depth tier.",
      },
      agent_status: {
        type: "string",
        enum: AGENT_READINESS_STATUSES,
        description: "Filter by agent-readiness status.",
      },
      blocker_level: {
        type: "string",
        enum: AGENT_BLOCKER_LEVELS,
        description: "Filter by agent blocker level.",
      },
      q: {
        type: "string",
        description:
          "Keyword search across name/slug/top_gap_codes/recommended_next_action.",
      },
      sort: {
        type: "string",
        enum: COVERAGE_DEPTH_SORT_FIELDS,
        description: "Field to sort by before paging.",
      },
      order: {
        type: "string",
        enum: ["asc", "desc"],
        description: "Sort direction for sort (default asc).",
      },
      fields: {
        type: "string",
        description:
          "Comma-separated projection of scorecard row fields to return.",
      },
      limit: {
        type: "integer",
        description: "Max rows to return (1-100). Enables pagination.",
        minimum: 1,
        maximum: 100,
      },
      cursor: {
        type: "integer",
        description: "Pagination cursor from a prior response's next_cursor.",
        minimum: 0,
      },
    },
    additionalProperties: false,
  },
};

const NULLABLE_STRING = { type: ["string", "null"] };
const NULLABLE_INT = { type: ["integer", "null"] };

export const LIST_COVERAGE_DEPTH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: true,
  required: ["rows"],
  properties: {
    generated_at: NULLABLE_STRING,
    coverage_depth_version: NULLABLE_STRING,
    rows: { type: "array", items: { type: "object" } },
    total: { type: "integer" },
    returned: { type: "integer" },
    limit: { type: "integer" },
    cursor: { type: "integer" },
    next_cursor: NULLABLE_INT,
    sort: NULLABLE_STRING,
    order: NULLABLE_STRING,
  },
};
