"""Every list limit is the shared page, not a private Query cap."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "app" / "shared" / "page.py"


def test_query_upper_bound_lives_on_the_page_dependency() -> None:
    offenders: list[str] = []
    for path in ROOT.rglob("*.py"):
        if path == PAGE or "tests" in path.parts or path.name == "test_page_size.py":
            continue
        text = path.read_text()
        for number, line in enumerate(text.splitlines(), start=1):
            if "Query(" in line and "le=" in line:
                offenders.append(f"{path.relative_to(ROOT)}:{number}")
    assert offenders == []
