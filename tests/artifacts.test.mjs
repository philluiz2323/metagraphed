import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function runNode(script) {
  execFileSync(process.execPath, [script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "pipe"
  });
}

test("registry validates", () => {
  runNode("scripts/validate.mjs");
});

test("artifact build emits public indexes", () => {
  runNode("scripts/build-artifacts.mjs");

  const subnets = JSON.parse(readFileSync("public/metagraph/subnets.json", "utf8"));
  const surfaces = JSON.parse(readFileSync("public/metagraph/surfaces.json", "utf8"));
  const health = JSON.parse(readFileSync("public/metagraph/health/latest.json", "utf8"));

  assert.equal(subnets.subnets.length, 2);
  assert.equal(surfaces.surfaces.length, 16);
  assert.equal(health.surfaces.length, 16);
  assert.deepEqual(
    subnets.subnets.map((subnet) => subnet.netuid),
    [7, 74]
  );
});
