"""The first provost is created from a hidden prompt, once."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.shared.auth.security import password_matches


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
