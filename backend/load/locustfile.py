"""Thin Locust scenarios for the hall API.

Run from backend/ after seed + uvicorn (see docs/load.md). Credentials come
from environment variables only — never hardcode username/password pairs here.
"""

from __future__ import annotations

import os

from locust import HttpUser, between, task


def _require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Set {name} for Locust load scenarios (see docs/load.md)."
        )
    return value


class HallApiUser(HttpUser):
    wait_time = between(0.5, 1.5)

    def on_start(self) -> None:
        self.warden_username = _require_env("LOAD_TEST_WARDEN_USERNAME")
        self.warden_password = _require_env("LOAD_TEST_WARDEN_PASSWORD")
        gate_username = _require_env("LOAD_TEST_GATE_USERNAME")
        gate_password = _require_env("LOAD_TEST_GATE_PASSWORD")
        self.resident_qr = _require_env("LOAD_TEST_RESIDENT_QR")
        self.warden_token = self._login(self.warden_username, self.warden_password)
        self.gate_token = self._login(gate_username, gate_password)

    def _login(self, username: str, phrase: str) -> str:
        body = {"username": username, "password": phrase}
        response = self.client.post(
            "/api/v1/auth/login",
            json=body,
            name="login",
        )
        response.raise_for_status()
        return response.json()["access_token"]

    def _auth(self, token: str) -> dict[str, str]:
        return {"Authorization": f"Bearer {token}"}

    @task(2)
    def login_again(self) -> None:
        body = {
            "username": self.warden_username,
            "password": self.warden_password,
        }
        self.client.post(
            "/api/v1/auth/login",
            json=body,
            name="login",
        )

    @task(3)
    def register_board(self) -> None:
        headers = self._auth(self.warden_token)
        self.client.get("/api/v1/register/summary", headers=headers, name="register_summary")
        self.client.get(
            "/api/v1/register/residents",
            params={"limit": 50, "offset": 0},
            headers=headers,
            name="register_residents",
        )

    @task(2)
    def permissions_queue(self) -> None:
        self.client.get(
            "/api/v1/permissions",
            params={"limit": 50, "offset": 0},
            headers=self._auth(self.warden_token),
            name="permissions_queue",
        )

    @task(2)
    def gate_scan(self) -> None:
        self.client.post(
            "/api/v1/gate/scans",
            json={"qr_payload": self.resident_qr},
            headers=self._auth(self.gate_token),
            name="gate_scan",
        )
