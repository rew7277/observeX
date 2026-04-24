#!/usr/bin/env python3
"""
check_chart_types.py
====================
Scans the ObserveX Next.js codebase and validates that every field
fed into a chart component matches that component's declared prop type.

Also auto-fixes known mismatches in lib/workspace.ts.

Usage:
    python check_chart_types.py [--fix] [--root /path/to/observex-fixed]
"""

import re
import sys
import argparse
from pathlib import Path

# ─────────────────────────────────────────────────────────────────────────────
# Ground truth: what each chart component in components/charts.tsx expects
# ─────────────────────────────────────────────────────────────────────────────
CHART_PROP_TYPES: dict[str, list[str]] = {
    "TimelineChart":      ["time", "avgLatency", "errors", "warns"],
    "DistributionPie":    ["name", "value"],
    "ApplicationBar":     ["name", "value"],
    "LevelBreakdownBar":  ["name", "value"],
}

# ─────────────────────────────────────────────────────────────────────────────
# Known fixes: (old_field, new_field) pairs to apply in workspace.ts
# ─────────────────────────────────────────────────────────────────────────────
KNOWN_FIXES: list[tuple[str, str]] = [
    # chart data key renames that have bitten us repeatedly
    ("warnings:", "warns:"),
    ('"warnings"', '"warns"'),
    # applications/environments use value not count for charts
    ("name: a.application, count:", "name: a.application, value:"),
    ("name: e.environment, count:", "name: e.environment, value:"),
    # levels rename
    ("level: l.level, count:", "name: l.level, value:"),
    # type definition fixes
    ("applications: { name: string; count: number }[]", "applications: { name: string; value: number }[]"),
    ("environments: { name: string; count: number }[]", "environments: { name: string; value: number }[]"),
    ("levels: { level: string; count: number }[]",      "levels: { name: string; value: number }[]"),
    ("timeline: { time: string; errors: number; warnings: number;", "timeline: { time: string; errors: number; warns: number;"),
    ("{ errors: number; warnings: number; latencies:", "{ errors: number; warns: number; latencies:"),
    ("{ errors: 0, warnings: 0,", "{ errors: 0, warns: 0,"),
    ("b.warnings++", "b.warns++"),
    ("warnings:   b.warnings", "warns:      b.warns"),
]

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def find_root(given: str | None) -> Path:
    """Resolve the project root, searching upward if needed."""
    if given:
        return Path(given).resolve()
    cwd = Path.cwd()
    for candidate in [cwd, *cwd.parents]:
        if (candidate / "components" / "charts.tsx").exists():
            return candidate
    sys.exit(
        "ERROR: Cannot find project root (no components/charts.tsx found).\n"
        "Run from inside the project or pass --root /path/to/project"
    )


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# Step 1 — Parse charts.tsx to extract the actual prop field names
# ─────────────────────────────────────────────────────────────────────────────

def parse_chart_props(charts_path: Path) -> dict[str, list[str]]:
    """
    Read components/charts.tsx and extract the Array<{...}> field names
    for each exported chart function, returning a dict keyed by function name.
    Falls back to CHART_PROP_TYPES if parsing fails.
    """
    src = read(charts_path)
    result: dict[str, list[str]] = {}

    # Match: export function FooChart({ data }: { data: Array<{ f1: T; f2: T; ... }> })
    fn_re = re.compile(
        r'export function (\w+Chart|\w+Bar|\w+Pie)\b.*?data:\s*Array<\{([^}]+)\}>',
        re.DOTALL,
    )
    field_re = re.compile(r'(\w+)\s*:')

    for m in fn_re.finditer(src):
        name   = m.group(1)
        fields = field_re.findall(m.group(2))
        if fields:
            result[name] = fields

    # Merge with ground-truth (parsed values take precedence)
    merged = {**CHART_PROP_TYPES, **result}
    return merged


# ─────────────────────────────────────────────────────────────────────────────
# Step 2 — Scan all page TSX files for chart component usages
# ─────────────────────────────────────────────────────────────────────────────

def scan_pages(root: Path) -> list[tuple[Path, int, str, str]]:
    """
    Returns list of (file, line_no, component_name, data_prop_expression)
    for every <ComponentName data={...} /> invocation found.
    """
    usage_re = re.compile(r'<(\w+Chart|\w+Bar|\w+Pie)\s[^>]*data=\{([^}]+)\}')
    usages   = []

    for tsx in root.rglob("*.tsx"):
        if "node_modules" in tsx.parts or "components" in tsx.parts:
            continue
        src = read(tsx)
        for lineno, line in enumerate(src.splitlines(), 1):
            for m in usage_re.finditer(line):
                comp = m.group(1)
                expr = m.group(2).strip()
                usages.append((tsx, lineno, comp, expr))

    return usages


# ─────────────────────────────────────────────────────────────────────────────
# Step 3 — Parse workspace.ts AggregatedMetrics type block
# ─────────────────────────────────────────────────────────────────────────────

def parse_metrics_type(workspace_path: Path) -> dict[str, list[str]]:
    """
    Parse the AggregatedMetrics type in lib/workspace.ts.
    Returns { field_name: [property, ...] } for every array field.
    E.g. {"levels": ["name", "value"], "timeline": ["time", "errors", ...]}
    """
    src = read(workspace_path)

    # Grab the AggregatedMetrics block
    block_m = re.search(r'export type AggregatedMetrics\s*=\s*\{(.+?)\n\};', src, re.DOTALL)
    if not block_m:
        return {}

    block = block_m.group(1)
    field_re   = re.compile(r'(\w+):\s*\{([^}]+)\}\[\]')
    prop_re    = re.compile(r'(\w+)\s*:')
    result: dict[str, list[str]] = {}

    for m in field_re.finditer(block):
        fname  = m.group(1)
        props  = prop_re.findall(m.group(2))
        result[fname] = props

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Step 4 — Resolve a JSX data expression to a metrics field name
# ─────────────────────────────────────────────────────────────────────────────

def resolve_field(expr: str) -> str | None:
    """
    Given an expression like "metrics.timeline" or "metrics.applications"
    return the last segment ("timeline", "applications", etc.).
    Returns None if the expression doesn't look like a metrics field.
    """
    m = re.search(r'metrics\.(\w+)', expr)
    return m.group(1) if m else None


# ─────────────────────────────────────────────────────────────────────────────
# Step 5 — Compare and report mismatches
# ─────────────────────────────────────────────────────────────────────────────

def check(root: Path, fix: bool) -> bool:
    charts_path    = root / "components" / "charts.tsx"
    workspace_path = root / "lib" / "workspace.ts"

    if not charts_path.exists():
        print(f"ERROR: {charts_path} not found"); return False
    if not workspace_path.exists():
        print(f"ERROR: {workspace_path} not found"); return False

    chart_props   = parse_chart_props(charts_path)
    metrics_types = parse_metrics_type(workspace_path)
    usages        = scan_pages(root)

    print(f"\n{'='*60}")
    print(f"  ObserveX Chart-Type Validator")
    print(f"{'='*60}")
    print(f"  Charts parsed : {len(chart_props)}")
    print(f"  Metrics fields: {len(metrics_types)}")
    print(f"  Chart usages  : {len(usages)}")
    print(f"{'='*60}\n")

    errors_found = False

    for tsx_path, lineno, comp, expr in usages:
        expected = chart_props.get(comp)
        if not expected:
            print(f"  WARN  unknown component '{comp}' — skipping")
            continue

        field = resolve_field(expr)
        if not field:
            # Dynamic expression, can't statically verify
            continue

        actual = metrics_types.get(field)
        if actual is None:
            print(f"  WARN  {tsx_path.name}:{lineno}  '{field}' not found in AggregatedMetrics")
            continue

        missing = [k for k in expected if k not in actual]
        extra   = [k for k in actual   if k not in expected and k != "name"]

        rel = tsx_path.relative_to(root)
        if missing or extra:
            errors_found = True
            print(f"  FAIL  {rel}:{lineno}")
            print(f"        Component : {comp}")
            print(f"        Expression: {expr}")
            print(f"        Expected  : {expected}")
            print(f"        Got       : {actual}")
            if missing: print(f"        Missing   : {missing}  ← chart uses these but data doesn't have them")
            if extra:   print(f"        Extra     : {extra}   ← data has these but chart ignores them")
            print()
        else:
            print(f"  OK    {rel}:{lineno}  {comp} ← {field}")

    print()
    if errors_found:
        print("  RESULT: ❌  Mismatches found!")
    else:
        print("  RESULT: ✅  All chart props match their data sources.")

    return not errors_found


# ─────────────────────────────────────────────────────────────────────────────
# Step 6 — Auto-fix workspace.ts
# ─────────────────────────────────────────────────────────────────────────────

def apply_fixes(root: Path) -> None:
    workspace_path = root / "lib" / "workspace.ts"
    if not workspace_path.exists():
        print(f"ERROR: {workspace_path} not found"); return

    src     = original = read(workspace_path)
    changed = []

    for old, new in KNOWN_FIXES:
        if old in src:
            src = src.replace(old, new)
            changed.append((old.strip(), new.strip()))

    if changed:
        write(workspace_path, src)
        print(f"\n  AUTO-FIX applied {len(changed)} substitution(s) to lib/workspace.ts:")
        for old, new in changed:
            print(f"    - '{old}'  →  '{new}'")
    else:
        print("\n  AUTO-FIX: nothing to change — file already looks correct.")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Validate ObserveX chart prop types vs data shapes")
    parser.add_argument("--root", default=None, help="Path to project root (auto-detected if omitted)")
    parser.add_argument("--fix",  action="store_true", help="Auto-fix known mismatches in lib/workspace.ts")
    args = parser.parse_args()

    root = find_root(args.root)
    print(f"\n  Project root: {root}")

    if args.fix:
        print("\n  Running auto-fix BEFORE validation ...\n")
        apply_fixes(root)
        print()

    ok = check(root, fix=False)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
