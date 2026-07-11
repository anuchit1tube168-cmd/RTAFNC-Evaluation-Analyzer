#!/usr/bin/env python3
"""Static validation gate for the RTAFNC Parent Evaluation Apps Script project."""

from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
GAS = ROOT / "google-apps-script"

REQUIRED_FILES = [
    GAS / "Parent_Evaluation.html",
    GAS / "Parent_Evaluation_Styles.html",
    GAS / "Parent_Evaluation_App.html",
    GAS / "Parent_Evaluation_Helpers.gs",
    GAS / "Parent_Evaluation_Config.gs",
    GAS / "Parent_Evaluation_Activities.gs",
    GAS / "Parent_Evaluation_Import.gs",
    GAS / "Parent_Evaluation_Reports.gs",
    GAS / "ZZ_V6_ApiGet_Override.gs",
    GAS / "appsscript.json",
    ROOT / "skills" / "parent-evaluation-system" / "SKILL.md",
    ROOT / "skills" / "parent-evaluation-system" / "LLM_WIKI.md",
    ROOT / "skills" / "parent-evaluation-system" / "CHECKLIST.md",
    ROOT / "skills" / "parent-evaluation-system" / "TEST_PLAN.md",
    ROOT / "skills" / "parent-evaluation-system" / "EXAMPLES.md",
    ROOT / "skills" / "parent-evaluation-system" / "AGENT_INJECTION.md",
    ROOT / "docs" / "parent-evaluation" / "PRD.md",
    ROOT / "docs" / "parent-evaluation" / "DATA_SCHEMA.md",
    ROOT / "docs" / "parent-evaluation" / "USER_FLOW.md",
    ROOT / "docs" / "parent-evaluation" / "UI_SPEC.md",
    ROOT / "docs" / "parent-evaluation" / "VALIDATION.md",
    ROOT / "docs" / "parent-evaluation" / "DEPLOYMENT_PLAN.md",
    ROOT / "docs" / "parent-evaluation" / "GOLDEN_TEMPLATE_MAP.md",
    ROOT / "docs" / "parent-evaluation" / "QA_RECEIPT_TEMPLATE.md",
]

CHECKS = {
    GAS / "Parent_Evaluation.html": [
        "PE_include_('Parent_Evaluation_Styles')",
        "PE_include_('Parent_Evaluation_App')",
        "แผนกปกครอง วพอ.พอ.",
    ],
    GAS / "ZZ_V6_ApiGet_Override.gs": [
        "return buildParentEvaluationPage_();",
        "mode === 'upload'",
        "parentdiagnostic",
    ],
    GAS / "Parent_Evaluation_Config.gs": [
        "parent-evaluation-v1.3.0",
        "PE_Imports",
        "PE_withLock_",
        "Template CSS พร้อม",
    ],
    GAS / "Parent_Evaluation_Activities.gs": [
        "ต้องระบุชื่อ-สกุลนักเรียน",
        "คะแนนต้องเป็น 1-5",
        "allowDuplicate",
        ".setValues(itemRows)",
    ],
    GAS / "Parent_Evaluation_Import.gs": [
        "PE_importFingerprint_",
        "PE_isSummaryHeader_",
        "alreadyImported",
        ".setValues(responseRows)",
    ],
    GAS / "Parent_Evaluation_Reports.gs": [
        "TH Sarabun New",
        "official-governance-v1",
        "แผนกปกครอง วิทยาลัยพยาบาลทหารอากาศ",
        "ค้นหาด้วยรหัสนักเรียน",
    ],
}


def fail(message: str) -> None:
    print(f"FAIL: {message}")
    raise SystemExit(1)


def read(path: pathlib.Path) -> str:
    return path.read_text(encoding="utf-8")


def check_required_files() -> None:
    missing = [str(path.relative_to(ROOT)) for path in REQUIRED_FILES if not path.exists()]
    if missing:
        fail("missing required files: " + ", ".join(missing))
    print(f"PASS: required files ({len(REQUIRED_FILES)})")


def check_markers() -> None:
    for path, markers in CHECKS.items():
        text = read(path)
        for marker in markers:
            if marker not in text:
                fail(f"{path.relative_to(ROOT)} missing marker: {marker}")
    print("PASS: architecture/template markers")


def check_non_destructive_schema() -> None:
    config = read(GAS / "Parent_Evaluation_Config.gs")
    destructive_patterns = [r"\.clear\s*\(", r"\.deleteSheet\s*\("]
    for pattern in destructive_patterns:
        if re.search(pattern, config):
            fail(f"destructive schema operation found: {pattern}")
    print("PASS: non-destructive schema guard")


def node_check(source: str, label: str) -> None:
    with tempfile.NamedTemporaryFile("w", suffix=".js", encoding="utf-8", delete=False) as handle:
        handle.write(source)
        temp_path = pathlib.Path(handle.name)
    try:
        result = subprocess.run(
            ["node", "--check", str(temp_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            fail(f"JavaScript syntax error in {label}: {result.stderr.strip()}")
    finally:
        temp_path.unlink(missing_ok=True)


def check_javascript_syntax() -> None:
    for path in sorted(GAS.glob("*.gs")):
        node_check(read(path), str(path.relative_to(ROOT)))

    app_html = read(GAS / "Parent_Evaluation_App.html")
    match = re.search(r"<script>(.*)</script>", app_html, flags=re.S | re.I)
    if not match:
        fail("Parent_Evaluation_App.html must contain one <script> block")
    node_check(match.group(1), "google-apps-script/Parent_Evaluation_App.html")
    print("PASS: Apps Script and frontend JavaScript syntax")


def check_manifest() -> None:
    manifest = json.loads(read(GAS / "appsscript.json"))
    scopes = set(manifest.get("oauthScopes", []))
    required_scopes = {
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/documents",
    }
    missing = required_scopes - scopes
    if missing:
        fail("manifest missing scopes: " + ", ".join(sorted(missing)))
    if manifest.get("webapp", {}).get("executeAs") != "USER_DEPLOYING":
        fail("webapp.executeAs must be USER_DEPLOYING")
    print("PASS: Apps Script manifest")


def main() -> int:
    check_required_files()
    check_markers()
    check_non_destructive_schema()
    check_javascript_syntax()
    check_manifest()
    print("PASS: parent evaluation validation gate complete")
    return 0


if __name__ == "__main__":
    sys.exit(main())
