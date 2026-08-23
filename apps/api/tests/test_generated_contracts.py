from pathlib import Path

from packages.contracts.export import generate_typescript


GENERATED_TYPES = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "contracts"
    / "generated"
    / "contracts.ts"
)


def test_generated_typescript_is_current() -> None:
    assert GENERATED_TYPES.read_text(encoding="utf-8") == generate_typescript()
