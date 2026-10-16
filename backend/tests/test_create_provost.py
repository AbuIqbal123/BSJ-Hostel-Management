"""The first provost is created from a hidden prompt, once."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.auth.password_rules import PASSWORD_CLASSES_MESSAGE
from app.shared.auth.security import password_matches
from app.shared.config import get_settings
from app.shared.testing_env import production_signing_key_for_tests


def _script():
    path = Path(__file__).resolve().parents[1] / "scripts" / "create_provost.py"
    spec = importlib.util.spec_from_file_location("create_provost", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_first_provost_is_created_once_and_can_sign_in(database_path: Path) -> None:
    module = _script()
    secret = "Provost-Pass-1!"
    assert module.create_first_provost("hall.provost", "Hall Provost", secret) == "created"
    assert module.create_first_provost("other.provost", "Other Provost", "Other-Pass-9!") == "exists"

    connection_path = database_path
    import sqlite3

    connection = sqlite3.connect(connection_path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT users.username, users.password_hash, staff.job_title
            FROM users
            JOIN staff ON staff.user_id = users.id
            WHERE users.role = 'provost'
            """
        ).fetchall()
    finally:
        connection.close()
    assert len(rows) == 1
    assert rows[0]["username"] == "hall.provost"
    assert rows[0]["job_title"] == "Provost"
    assert password_matches(rows[0]["password_hash"], secret)
    assert not password_matches(rows[0]["password_hash"], "Other-Pass-9!")

    from app.main import app

    with TestClient(app) as client:
        signed_in = client.post(
            "/api/v1/auth/login",
            json={"username": "hall.provost", "password": secret},
        )
        assert signed_in.status_code == 200
        assert signed_in.json()["user"]["role"] == "provost"
        assert secret not in signed_in.text


def test_provost_script_refuses_a_password_argument(
    database_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _script()
    secret = "Provost-Pass-1!"
    prompted: list[str] = []

    def prompt(_label: str = "") -> str:
        prompted.append("asked")
        return secret

    monkeypatch.setattr("getpass.getpass", prompt)
    with pytest.raises(SystemExit, match="prompt"):
        module.main(
            ["--username", "hall.provost", "--full-name", "Hall Provost", "--password", secret]
        )
    captured = capsys.readouterr()
    assert secret not in captured.out
    assert secret not in captured.err
    assert prompted == []
    assert not database_path.exists() or _provost_count(database_path) == 0


def test_provost_script_prompts_and_does_not_print_the_password(
    database_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _script()
    secret = "Provost-Pass-1!"
    answers = iter((secret, secret))

    def prompt(_label: str = "") -> str:
        return next(answers)

    monkeypatch.setattr("getpass.getpass", prompt)
    assert module.main(["--username", "hall.provost", "--full-name", "Hall Provost"]) == 0
    created = capsys.readouterr()
    assert secret not in created.out
    assert secret not in created.err
    assert "Created the provost account." in created.out

    def refuse(_label: str = "") -> str:
        raise AssertionError("prompted")

    monkeypatch.setattr("getpass.getpass", refuse)
    assert module.main(["--username", "hall.provost", "--full-name", "Hall Provost"]) == 0
    again = capsys.readouterr()
    assert "already exists" in again.out
    assert secret not in again.out


def test_dev_defaults_creates_the_local_provost_once(
    database_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _script()
    assert module.main(["--dev-defaults"]) == 0
    created = capsys.readouterr()
    assert "Created the provost account." in created.out
    assert "provost123" not in created.out
    assert "provost123" not in created.err

    import sqlite3

    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        rows = connection.execute(
            """
            SELECT users.username, users.password_hash, staff.job_title
            FROM users
            JOIN staff ON staff.user_id = users.id
            WHERE users.role = 'provost'
            """
        ).fetchall()
    finally:
        connection.close()
    assert len(rows) == 1
    assert rows[0]["username"] == "provost123"
    assert rows[0]["job_title"] == "Provost"
    assert password_matches(rows[0]["password_hash"], "provost123")
    first_hash = rows[0]["password_hash"]

    from app.main import app

    with TestClient(app) as client:
        signed_in = client.post(
            "/api/v1/auth/login",
            json={"username": "provost123", "password": "provost123"},
        )
        assert signed_in.status_code == 200
        body = signed_in.json()
        assert body["user"]["username"] == "provost123"
        assert body["user"]["role"] == "provost"
        assert "password" not in body["user"]

    assert module.main(["--dev-defaults"]) == 0
    again = capsys.readouterr()
    assert "already exists" in again.out
    assert "provost123" not in again.out
    connection = sqlite3.connect(database_path)
    try:
        row = connection.execute(
            "SELECT password_hash FROM users WHERE role = 'provost'"
        ).fetchone()
    finally:
        connection.close()
    assert row[0] == first_hash


def test_dev_defaults_leaves_an_existing_provost(
    database_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _script()
    secret = "Provost-Pass-1!"
    assert module.create_first_provost("hall.provost", "Hall Provost", secret) == "created"
    assert module.main(["--dev-defaults"]) == 0
    captured = capsys.readouterr()
    assert "already exists" in captured.out
    assert _provost_count(database_path) == 1

    import sqlite3

    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            "SELECT username, password_hash FROM users WHERE role = 'provost'"
        ).fetchone()
    finally:
        connection.close()
    assert row["username"] == "hall.provost"
    assert password_matches(row["password_hash"], secret)
    assert not password_matches(row["password_hash"], "provost123")


def test_dev_defaults_refuses_production_and_a_turso_url(
    database_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _script()
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.setenv("APP_SECRET_KEY", production_signing_key_for_tests())
    get_settings.cache_clear()
    assert module.main(["--dev-defaults"]) == 2
    production = capsys.readouterr()
    assert "production" in production.err.lower()
    assert "provost123" not in production.out
    assert "provost123" not in production.err
    assert not database_path.exists()

    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("TURSO_DATABASE_URL", "libsql://bsj-hall.turso.io")
    monkeypatch.setenv("TURSO_AUTH_TOKEN", "not-used")
    get_settings.cache_clear()
    assert module.main(["--dev-defaults"]) == 2
    hosted = capsys.readouterr()
    assert "turso" in hosted.err.lower()
    assert "provost123" not in hosted.out
    assert "provost123" not in hosted.err
    assert not database_path.exists()


def test_normal_path_rejects_the_dev_password(
    database_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    module = _script()
    with pytest.raises(ValueError, match="uppercase"):
        module.create_first_provost("provost123", "Test Provost", "provost123")
    assert not database_path.exists() or _provost_count(database_path) == 0

    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("DEBUG", "false")
    monkeypatch.setenv("CORS_ORIGINS", "")
    monkeypatch.setenv("APP_SECRET_KEY", production_signing_key_for_tests())
    get_settings.cache_clear()
    answers = iter(("provost123", "provost123"))

    def prompt(_label: str = "") -> str:
        return next(answers)

    monkeypatch.setattr("getpass.getpass", prompt)
    assert module.main(["--username", "provost123", "--full-name", "Test Provost"]) == 2
    captured = capsys.readouterr()
    assert PASSWORD_CLASSES_MESSAGE in captured.err
    assert _provost_count(database_path) == 0


def _provost_count(path: Path) -> int:
    import sqlite3

    if not path.is_file():
        return 0
    connection = sqlite3.connect(path)
    try:
        row = connection.execute("SELECT COUNT(*) FROM users WHERE role = 'provost'").fetchone()
    except sqlite3.OperationalError:
        return 0
    finally:
        connection.close()
    return int(row[0])
