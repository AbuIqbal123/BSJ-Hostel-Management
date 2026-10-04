"""A permission decision is one inbox row for that resident."""

from __future__ import annotations

from app.shared.testing_env import signing_key_for_tests

import json
import sqlite3
from collections.abc import Iterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.dev_seed import RESIDENT_PHRASE, WARDEN_PHRASE, joined


ARTIFACT = Path(__file__).resolve().parent / "artifacts" / "resident-notifications.json"
BLOCK_B = "d032aad6-a203-5ea0-ba9a-3a9257edbfc8"
WARDEN_ID = "e55fa000-0000-4000-8000-000000000005"
AISHA_ID = "b22de000-0000-4000-8000-000000000002"
ZARA_ID = "d55fa000-0000-4000-8000-00000000000a"
ROOM_B204 = "d4400000-0000-4000-8000-000000000004"
ROOM_B205 = "d4400000-0000-4000-8000-000000000005"
CREATED = "2026-09-30T00:00:00Z"
STABLE = (
    "permission_type",
    "decision",
    "place",
    "departure_at",
    "expected_return_at",
    "decided_by_name",
    "created_at",
    "unread",
)


class FrozenClock:
    def __init__(self) -> None:
        self.moment = datetime(2026, 9, 30, 13, 0, tzinfo=timezone.utc)

    def utc_now(self) -> datetime:
        return self.moment

    def advance(self) -> None:
        self.moment += timedelta(seconds=1)


@pytest.fixture
def database_path(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    path = tmp_path / "hostel.db"
    monkeypatch.setenv("DATABASE_PATH", str(path))
    monkeypatch.setenv("ENVIRONMENT", "development")
    monkeypatch.setenv("SMS_DRIVER", "mock")
    monkeypatch.setenv("APP_SECRET_KEY", signing_key_for_tests())
    from app.shared.config import get_settings

    get_settings.cache_clear()
    yield path
    get_settings.cache_clear()


def assert_error(response, status: int, code: str, message: str) -> None:
    assert response.status_code == status
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"] == {"code": code, "message": message}


def sign_in(client: TestClient, username: str, password: str) -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def stable(items: list[dict]) -> list[dict]:
    return [{key: item[key] for key in STABLE} for item in items]


def issue_people(path: Path) -> None:
    from app.shared.auth.security import hash_password

    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        connection.executemany(
            """
            INSERT INTO rooms (id, block_id, number, label, bed_count, is_active)
            VALUES (?, ?, ?, ?, 2, 1)
            """,
            (
                (ROOM_B204, BLOCK_B, "204", "B-204"),
                (ROOM_B205, BLOCK_B, "205", "B-205"),
            ),
        )
        connection.execute(
            """
            INSERT INTO users (
              id, role, username, full_name, password_hash, status, created_at, updated_at
            ) VALUES (?, 'warden', 'warden.sara', 'Sara Malik', ?, 'active', ?, ?)
            """,
            (WARDEN_ID, hash_password(WARDEN_PHRASE), CREATED, CREATED),
        )
        connection.execute(
            "INSERT INTO staff (user_id, job_title) VALUES (?, 'Warden')",
            (WARDEN_ID,),
        )
        for user_id, username, full_name, password, room_id, course, guardian, phone, token in (
            (
                AISHA_ID,
                "24-GLLB-118",
                "Aisha Khan",
                RESIDENT_PHRASE,
                ROOM_B204,
                "B.A. LL.B. (Hons.)",
                "Rashid Khan",
                "+919876543210",
                "bsj:v1:test-aisha",
            ),
            (
                ZARA_ID,
                "24-BA-003",
                "Zara Ahmed",
                joined("resident", "30"),
                ROOM_B205,
                "B.A.",
                "Imran Ahmed",
                "+919876543212",
                "bsj:v1:test-zara",
            ),
        ):
            connection.execute(
                """
                INSERT INTO users (
                  id, role, username, full_name, password_hash, status, created_at, updated_at
                ) VALUES (?, 'resident', ?, ?, ?, 'active', ?, ?)
                """,
                (user_id, username, full_name, hash_password(password), CREATED, CREATED),
            )
            connection.execute(
                """
                INSERT INTO residents (
                  user_id, enrolment_number, course, room_id, guardian_name, guardian_phone,
                  qr_token, presence, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'inside', ?, ?)
                """,
                (user_id, username, course, room_id, guardian, phone, token, CREATED, CREATED),
            )
        connection.commit()
    finally:
        connection.close()


def submit(client: TestClient, token: str, body: dict) -> str:
    response = client.post("/api/v1/me/permissions", headers=auth(token), json=body)
    assert response.status_code == 201
    return response.json()["id"]


def decide(client: TestClient, token: str, permission_id: str, decision: str) -> None:
    response = client.post(
        f"/api/v1/permissions/{permission_id}/decision",
        headers=auth(token),
        json={"decision": decision},
    )
    assert response.status_code == 200
    assert response.json()["status"] == decision


def unread_count(path: Path, resident_id: str) -> int:
    connection = sqlite3.connect(path)
    try:
        return connection.execute(
            """
            SELECT COUNT(*) FROM resident_notifications
            WHERE resident_id = ? AND read_at IS NULL
            """,
            (resident_id,),
        ).fetchone()[0]
    finally:
        connection.close()


def test_resident_notification_inbox(database_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    expected = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    from app.shared import clock
    from app.main import app

    frozen = FrozenClock()
    monkeypatch.setattr(clock, "utc_now", frozen.utc_now)
    with TestClient(app) as client:
        issue_people(database_path)
        assert_error(
            client.get("/api/v1/me/notifications"),
            401,
            "unauthenticated",
            "Sign in again.",
        )
        aisha = sign_in(client, "24-GLLB-118", RESIDENT_PHRASE)
        zara = sign_in(client, "24-BA-003", joined("resident", "30"))
        warden = sign_in(client, "warden.sara", WARDEN_PHRASE)
        assert_error(
            client.get("/api/v1/me/notifications", headers=auth(warden)),
            403,
            "forbidden",
            "This account cannot do that.",
        )

        empty = client.get("/api/v1/me/notifications", headers=auth(aisha))
        assert empty.status_code == 200
        assert empty.json() == {"items": []}
        home = client.get("/api/v1/me/home", headers=auth(aisha))
        assert home.status_code == 200
        assert home.json()["notifications_unread"] is False

        late_id = submit(
            client,
            aisha,
            {
                "permission_type": "late_night",
                "short_place": "Women's College",
                "reason": "Seminar.",
                "departure_at": "2026-09-30T14:00:00Z",
                "expected_return_at": "2026-09-30T18:00:00Z",
            },
        )
        decide(client, warden, late_id, "approved")
        assert unread_count(database_path, AISHA_ID) == 1

        listed = client.get("/api/v1/me/notifications", headers=auth(aisha))
        assert listed.status_code == 200
        assert unread_count(database_path, AISHA_ID) == 1
        one = listed.json()["items"]
        assert len(one) == 1
        assert one[0]["permission_id"] == late_id
        assert one[0]["unread"] is True
        assert client.get("/api/v1/me/home", headers=auth(aisha)).json()["notifications_unread"] is True
        assert client.get("/api/v1/me/notifications", headers=auth(zara)).json() == {"items": []}
        assert client.get("/api/v1/me/home", headers=auth(zara)).json()["notifications_unread"] is False

        frozen.advance()
        zara_late = submit(
            client,
            zara,
            {
                "permission_type": "late_night",
                "short_place": "Library",
                "reason": "Reading.",
                "departure_at": "2026-09-30T15:00:00Z",
                "expected_return_at": "2026-09-30T18:00:00Z",
            },
        )
        decide(client, warden, zara_late, "approved")
        assert len(client.get("/api/v1/me/notifications", headers=auth(aisha)).json()["items"]) == 1

        frozen.advance()
        home_id = submit(
            client,
            aisha,
            {
                "permission_type": "home_going",
                "short_place": "Lucknow",
                "address": "12 Hazratganj",
                "reason": "Family.",
                "departure_at": "2026-10-02T04:00:00Z",
                "expected_return_at": "2026-10-04T12:00:00Z",
            },
        )
        decide(client, warden, home_id, "rejected")
        again = client.post(
            f"/api/v1/permissions/{home_id}/decision",
            headers=auth(warden),
            json={"decision": "approved"},
        )
        assert again.status_code == 409
        assert unread_count(database_path, AISHA_ID) == 2

        both = client.get("/api/v1/me/notifications", headers=auth(aisha))
        assert both.status_code == 200
        assert stable(both.json()["items"]) == expected["after_two_decisions"]
        assert [item["permission_id"] for item in both.json()["items"]] == [home_id, late_id]
        assert unread_count(database_path, AISHA_ID) == 2

        marked = client.post("/api/v1/me/notifications/read", headers=auth(aisha))
        assert marked.status_code == 200
        assert marked.json() == {"marked": 2}
        read = client.get("/api/v1/me/notifications", headers=auth(aisha))
        assert [item["unread"] for item in read.json()["items"]] == [False, False]
        assert client.get("/api/v1/me/home", headers=auth(aisha)).json()["notifications_unread"] is False
        second = client.post("/api/v1/me/notifications/read", headers=auth(aisha))
        assert second.json() == {"marked": 0}
        assert client.get("/api/v1/me/home", headers=auth(zara)).json()["notifications_unread"] is True

        _store_older_than_the_list(database_path)
        capped = client.get("/api/v1/me/notifications", headers=auth(aisha))
        assert capped.status_code == 200
        items = capped.json()["items"]
        assert len(items) == 50
        assert all(item["unread"] is True for item in items)
        assert items[0]["created_at"] > items[-1]["created_at"]
        assert late_id not in {item["permission_id"] for item in items}
        assert client.get("/api/v1/me/home", headers=auth(aisha)).json()["notifications_unread"] is True
        marked_all = client.post("/api/v1/me/notifications/read", headers=auth(aisha))
        assert marked_all.json() == {"marked": 51}
        assert unread_count(database_path, AISHA_ID) == 0
        assert client.get("/api/v1/me/home", headers=auth(aisha)).json()["notifications_unread"] is False


def _store_older_than_the_list(path: Path) -> None:
    """Fifty-one newer unread rows, so the list cap hides the older decisions."""
    connection = sqlite3.connect(path)
    try:
        connection.execute("PRAGMA foreign_keys=ON;")
        for index in range(1, 52):
            permission_id = f"{index:08x}-0000-4000-8000-000000000000"
            notice_id = f"{index:08x}-1111-4000-8000-000000000000"
            created = f"2026-10-02T00:{index // 60:02d}:{index % 60:02d}Z"
            connection.execute(
                """
                INSERT INTO permissions (
                  id, resident_id, type, status, short_place, destination_detail, address,
                  reason, departure_at, expected_return_at, decided_by, decided_at,
                  decision_note, created_at, updated_at
                ) VALUES (
                  ?, ?, 'late_night', 'approved', ?, NULL, NULL,
                  'Seeded for the list cap.', '2026-10-03T04:00:00Z', '2026-10-03T08:00:00Z',
                  ?, ?, NULL, ?, ?
                )
                """,
                (
                    permission_id,
                    AISHA_ID,
                    f"Place {index}",
                    WARDEN_ID,
                    created,
                    created,
                    created,
                ),
            )
            connection.execute(
                """
                INSERT INTO resident_notifications (
                  id, resident_id, permission_id, decision, created_at
                ) VALUES (?, ?, ?, 'approved', ?)
                """,
                (notice_id, AISHA_ID, permission_id, created),
            )
        connection.commit()
    finally:
        connection.close()
