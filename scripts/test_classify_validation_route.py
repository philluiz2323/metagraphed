#!/usr/bin/env python3
"""Unit tests for classify-validation-route.py.

The script mirrors the canonical classifier in scripts/submission-policy.mjs
(tested in tests/submission-gate.test.mjs) and must stay in sync with it. Like
test_fetch_events.py these are stdlib `unittest` only (zero deps), runnable BOTH:

    python3 scripts/test_classify_validation_route.py
    python3 -m unittest scripts.test_classify_validation_route
    python3 -m pytest scripts/test_classify_validation_route.py  # if available

classify-validation-route.py does all its work at module top level (reading
changed-files.txt and writing validate-route.json), so we exercise it as a
subprocess in a temp cwd rather than importing it.
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unittest

_SCRIPT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "classify-validation-route.py"
)


def classify(files):
    """Run the classifier over `files` and return the validate-route.json report."""
    with tempfile.TemporaryDirectory() as d:
        (pathlib.Path(d) / "changed-files.txt").write_text(
            "\n".join(files) + "\n", encoding="utf-8"
        )
        env = {k: v for k, v in os.environ.items() if k != "GITHUB_OUTPUT"}
        subprocess.run(
            [sys.executable, _SCRIPT], cwd=d, env=env, check=True,
            capture_output=True, text=True,
        )
        return json.loads(
            (pathlib.Path(d) / "validate-route.json").read_text(encoding="utf-8")
        )


class ClassifyValidationRouteTest(unittest.TestCase):
    def test_atomic_provider_candidate_pair_is_direct_pair(self):
        # The canonical classifier allows a debut provider + first surface together
        # (tests/submission-gate.test.mjs asserts scope === "direct-pair").
        report = classify(
            [
                "registry/candidates/community/acme.json",
                "registry/providers/community/acme.json",
            ]
        )
        self.assertEqual(report["scope"], "direct-pair")
        self.assertEqual(report["errors"], [])
        self.assertEqual(report["mode"], "ugc")

    def test_lone_candidate_and_lone_provider(self):
        cand = classify(["registry/candidates/community/acme.json"])
        self.assertEqual(cand["scope"], "direct-candidate")
        self.assertEqual(cand["mode"], "ugc")
        prov = classify(["registry/providers/community/acme.json"])
        self.assertEqual(prov["scope"], "direct-provider")
        self.assertEqual(prov["mode"], "ugc")

    def test_normal_pr(self):
        report = classify(["src/feeds.mjs", "README.md"])
        self.assertEqual(report["scope"], "normal-pr")
        self.assertEqual(report["mode"], "full")

    def test_direct_submission_with_unrelated_file_routes_to_full(self):
        # A direct submission that also touches an unrelated file is tampering and
        # must get the FULL validation suite, not the light ugc preflight.
        report = classify(
            ["registry/candidates/community/acme.json", "src/evil.mjs"]
        )
        self.assertEqual(report["scope"], "direct-candidate")
        self.assertTrue(
            any(e["category"] == "generated-artifact-tampering" for e in report["errors"])
        )
        self.assertEqual(report["mode"], "full")

    def test_two_candidates_is_unsupported_shape(self):
        report = classify(
            [
                "registry/candidates/community/a.json",
                "registry/candidates/community/b.json",
            ]
        )
        self.assertTrue(
            any(e["category"] == "unsupported-shape" for e in report["errors"])
        )
        self.assertEqual(report["mode"], "full")


if __name__ == "__main__":
    unittest.main()
