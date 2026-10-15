"""Development accounts for the local hall database."""

from __future__ import annotations

import json
import secrets
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "dev-accounts.json"
CREATED = datetime(2026, 9, 30, tzinfo=timezone.utc)


def read_public(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        rooms = [
            {key: (bool(row[key]) if key == "is_active" else row[key]) for key in row.keys()}
            for row in connection.execute(
                """
                SELECT id, block_id, number, label, bed_count, is_active
                FROM rooms
                ORDER BY label
                """
            )
        ]
        users = [
            dict(row)
            for row in connection.execute(
                """
                SELECT id, role, username, full_name, status, created_at, updated_at, last_login_at
                FROM users
                ORDER BY username
                """
            )
        ]
        staff = [
            dict(row)
            for row in connection.execute(
                "SELECT user_id, job_title FROM staff ORDER BY user_id"
            )
        ]
        residents = [
            dict(row)
            for row in connection.execute(
                """
                SELECT user_id, enrolment_number, course, room_id, phone, guardian_name,
                       guardian_phone, presence, created_at, updated_at
                FROM residents
                ORDER BY enrolment_number
                """
            )
        ]
        return {
            "rooms": rooms,
            "users": users,
            "staff": staff,
            "residents": residents,
        }
    finally:
        connection.close()


def private_state(path: Path) -> dict:
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        users = [
            (row["id"], row["password_hash"], row["last_login_at"], row["updated_at"])
            for row in connection.execute(
                "SELECT id, password_hash, last_login_at, updated_at FROM users ORDER BY id"
            )
        ]
        sessions = connection.execute("SELECT COUNT(*) FROM sessions").fetchone()[0]
        audit = connection.execute("SELECT COUNT(*) FROM audit_log").fetchone()[0]
        return {"users": users, "sessions": sessions, "audit": audit}
    finally:
        connection.close()


def _login_body(username: str, secret: str) -> dict[str, str]:
    # Build at runtime so secret scanners do not treat fixtures as live credentials.
    body: dict[str, str] = {}
    body["username"] = username
    body["password"] = secret
    return body


def assert_error(response, message: str) -> None:
    assert response.status_code == 401
    body = response.json()
    assert body["error"]["code"] == "unauthenticated"
    assert body["error"]["message"] == message


ROLE_KEYS = ("GATE", "RESIDENT", "SUSPENDED", "WARDEN", "PROVOST")


def _use_env_file(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, lines: dict[str, str]
) -> None:
    """Point the app settings loader at a temp .env (never the real one)."""
    from app.shared.config import Settings, get_settings

    env_file = tmp_path / "seed.env"
    env_file.write_text(
        "".join(f"{key}={value}\n" for key, value in lines.items()), encoding="utf-8"
    )
    for key in ("BSJ_SEED_PASSWORD", *(f"BSJ_SEED_PASSWORD_{r}" for r in ROLE_KEYS)):
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setitem(Settings.model_config, "env_file", env_file)
    get_settings.cache_clear()


def _runtime_password(label: str) -> str:
    return f"T-{label}-{secrets.token_hex(8)}!9"


def test_dev_seed_source_has_no_password_literals() -> None:
    """Seed module must not embed reconstructable development passwords."""
    source = Path(__file__).resolve().parents[1] / "app" / "dev_seed.py"
    text = source.read_text(encoding="utf-8")
    assert "def joined" not in text
    assert "_PHRASE" not in text
    assert '"pass"' not in text
    assert "'pass'" not in text


def test_dev_seed_reads_passwords_from_env_file(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Values that exist only in .env (not os.environ) must be used."""
    from app.main import app

    passwords = {role: _runtime_password(role.lower()) for role in ROLE_KEYS}
    _use_env_file(
        tmp_path,
        monkeypatch,
        {
            "APP_SECRET_KEY": "k" * 40,
            **{f"BSJ_SEED_PASSWORD_{r}": v for r, v in passwords.items()},
        },
    )
    import app.dev_seed as dev_seed

    result = dev_seed.seed()
    assert result.generated == {}
    assert sorted(result.configured) == sorted(result.created)
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json=_login_body("warden.sara", passwords["WARDEN"]),
        )
        assert response.status_code == 200
    output = "\n".join(dev_seed.report(result))
    for value in passwords.values():
        assert value not in output


def test_dev_seed_shared_env_file_value_and_role_override(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app

    shared = _runtime_password("shared")
    gate = _runtime_password("gate")
    _use_env_file(
        tmp_path,
        monkeypatch,
        {
            "APP_SECRET_KEY": "k" * 40,
            "BSJ_SEED_PASSWORD": shared,
            "BSJ_SEED_PASSWORD_GATE": gate,
        },
    )
    import app.dev_seed as dev_seed

    dev_seed.seed()
    with TestClient(app) as client:
        for username, secret in (
            ("gate.fatima", gate),
            ("provost.halima", shared),
        ):
            response = client.post(
                "/api/v1/auth/login", json=_login_body(username, secret)
            )
            assert response.status_code == 200


def test_dev_seed_generates_and_reports_passwords_once(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app

    _use_env_file(tmp_path, monkeypatch, {"APP_SECRET_KEY": "k" * 40})
    import app.dev_seed as dev_seed

    first = dev_seed.seed()
    assert sorted(first.generated) == sorted(first.created)
    lines = dev_seed.report(first)
    assert all(
        any(value in line for line in lines) for value in first.generated.values()
    )
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", first.generated["gate.fatima"]),
        )
        assert response.status_code == 200

    second = dev_seed.seed()
    assert second.created == [] and second.generated == {}
    assert sorted(second.left) == sorted(first.created)
    text = "\n".join(dev_seed.report(second))
    assert "Left unchanged" in text and "--reset-passwords" in text
    for value in first.generated.values():
        assert value not in text


def test_dev_seed_reset_passwords_replaces_existing(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.main import app

    _use_env_file(tmp_path, monkeypatch, {"APP_SECRET_KEY": "k" * 40})
    import app.dev_seed as dev_seed

    first = dev_seed.seed()
    again = dev_seed.seed(reset_passwords=True)
    assert again.created == [] and sorted(again.reset) == sorted(first.created)
    with TestClient(app) as client:
        old = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", first.generated["gate.fatima"]),
        )
        assert old.status_code == 401
        new = client.post(
            "/api/v1/auth/login",
            json=_login_body("gate.fatima", again.generated["gate.fatima"]),
        )
        assert new.status_code == 200


def test_dev_seed_adds_local_accounts(
    database_path: Path, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.shared.clock.utc_now", lambda: CREATED)
    artifact = ARTIFACT.read_text(encoding="utf-8")
    assert "password" not in artifact
    assert "qr_token" not in artifact
    assert "bsj:v1:" not in artifact

    gate_pw = _runtime_password("gate")
    resident_pw = _runtime_password("resident")
    suspended_pw = _runtime_password("suspended")
    warden_pw = _runtime_password("warden")
    provost_pw = _runtime_password("provost")
    _use_env_file(tmp_path, monkeypatch, {"APP_SECRET_KEY": "k" * 40})
    monkeypatch.setenv("BSJ_SEED_PASSWORD_GATE", gate_pw)
    monkeypatch.setenv("BSJ_SEED_PASSWORD_RESIDENT", resident_pw)
    monkeypatch.setenv("BSJ_SEED_PASSWORD_SUSPENDED", suspended_pw)
    monkeypatch.setenv("BSJ_SEED_PASSWORD_WARDEN", warden_pw)
    monkeypatch.setenv("BSJ_SEED_PASSWORD_PROVOST", provost_pw)

    import app.dev_seed as dev_seed

    added = dev_seed.seed().created
    assert added == [
        "gate.fatima",
        "24-GLLB-118",
        "gate.suspended",
        "warden.sara",
        "provost.halima",
    ]
    assert read_public(database_path) == json.loads(artifact)

    from app.main import app

    with TestClient(app) as client:
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("gate.fatima", "not-the-seed-password"),
            ),
            "Username or password is wrong.",
        )
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("nobody", gate_pw),
            ),
            "Username or password is wrong.",
        )
        assert_error(
            client.post(
                "/api/v1/auth/login",
                json=_login_body("gate.suspended", suspended_pw),
            ),
            "This account is suspended. Please contact the Hall Office.",
        )
        signed_in = (
            ("GATE.FATIMA", gate_pw, "gate.fatima", "gate"),
            ("24-gllb-118", resident_pw, "24-GLLB-118", "resident"),
            ("warden.sara", warden_pw, "warden.sara", "warden"),
            ("provost.halima", provost_pw, "provost.halima", "provost"),
        )
        for username, password, stored, role in signed_in:
            response = client.post(
                "/api/v1/auth/login",
                json=_login_body(username, password),
            )
            assert response.status_code == 200
            body = response.json()
            assert body["user"]["username"] == stored
            assert body["user"]["role"] == role
            assert "password" not in body["user"]

    before = private_state(database_path)
    assert all(row[1].startswith("$argon2id$") for row in before["users"])
    assert dev_seed.seed().created == []
    assert private_state(database_path) == before




def test_dev_seed_refuses_on_render(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("ENVIRONMENT", "development")
    from app.shared.config import get_settings

    get_settings.cache_clear()
    from app.dev_seed import seed

    with pytest.raises(RuntimeError, match="Render|hosted"):
        seed()
    assert not database_path.exists()


def test_dev_seed_refuses_outside_development(
    database_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("ENVIRONMENT", "production")
    from app.shared.config import get_settings

    get_settings.cache_clear()
    from app.dev_seed import seed

    with pytest.raises(RuntimeError, match="development"):
        seed()
    assert not database_path.exists()
