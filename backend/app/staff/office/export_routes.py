"""Provost register CSV export."""

from __future__ import annotations

import csv
import io
import sqlite3

from fastapi import APIRouter, Response

from app.residents.guests.records import derive_bucket
from app.shared import clock
from app.shared.auth.routes import ConnectionDep
from app.staff.office.routes import ProvostDep
from app.staff.register.records import register_state

router = APIRouter(prefix="/api/v1/admin", tags=["Hall office"])

CSV_HEADER = [
    "record_type",
    "full_name",
    "enrolment_number",
    "room_label",
    "block_code",
    "course",
    "presence",
    "state",
    "place",
    "exited_at",
    "expected_return_at",
    "grace_ends_at",
    "returned_at",
    "outing_type",
    "guardian_name",
    "guardian_phone",
    "guest_name",
    "relation",
    "host_name",
    "host_room_label",
    "guest_start_date",
    "guest_end_date",
    "payment_status",
    "guest_bucket",
    "arrived_at",
    "departed_at",
]


def _empty_row() -> dict[str, str]:
    return {key: "" for key in CSV_HEADER}


# Quoting a CSV field is not enough: a spreadsheet still treats a leading
# =, +, -, @, tab, or carriage return as a formula.
def _spreadsheet_cell(value: str) -> str:
    if value.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + value
    return value


def _write_row(writer: csv.DictWriter, item: dict[str, str]) -> None:
    writer.writerow({key: _spreadsheet_cell(value) for key, value in item.items()})


def build_register_csv(connection: sqlite3.Connection) -> str:
    now = clock.utc_now()
    now_text = clock.format_instant(now)
    today = clock.hall_local_date(connection, now)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_HEADER, lineterminator="\n")
    writer.writeheader()

    residents = connection.execute(
        """
        SELECT
          users.full_name,
          residents.enrolment_number,
          rooms.label AS room_label,
          blocks.code AS block_code,
          residents.course,
          residents.presence,
          residents.guardian_name,
          residents.guardian_phone,
          open_outing.place,
          open_outing.exited_at,
          open_outing.expected_return_at,
          open_outing.grace_ends_at,
          open_outing.returned_at,
          open_outing.type AS outing_type
        FROM residents
        JOIN users ON users.id = residents.user_id
        JOIN rooms ON rooms.id = residents.room_id
        JOIN blocks ON blocks.id = rooms.block_id
        LEFT JOIN outings AS open_outing
          ON open_outing.resident_id = residents.user_id
         AND open_outing.status = 'outside'
        WHERE users.status = 'active'
          AND users.role = 'resident'
        ORDER BY users.full_name COLLATE NOCASE, users.id
        """
    ).fetchall()
    for row in residents:
        state = register_state(row["presence"], row["grace_ends_at"], now_text)
        item = _empty_row()
        item.update(
            {
                "record_type": "resident",
                "full_name": row["full_name"],
                "enrolment_number": row["enrolment_number"],
                "room_label": row["room_label"],
                "block_code": row["block_code"],
                "course": row["course"] or "",
                "presence": row["presence"],
                "state": state,
                "guardian_name": row["guardian_name"],
                "guardian_phone": row["guardian_phone"],
            }
        )
        if state != "inside":
            item["place"] = row["place"] or ""
            item["exited_at"] = row["exited_at"] or ""
            item["expected_return_at"] = row["expected_return_at"] or ""
            item["grace_ends_at"] = row["grace_ends_at"] or ""
            item["returned_at"] = row["returned_at"] or ""
            item["outing_type"] = row["outing_type"] or ""
        _write_row(writer, item)

    guests = connection.execute(
        """
        SELECT
          guest_stays.guest_name,
          guest_stays.relation,
          guest_stays.guest_start_date,
          guest_stays.guest_end_date,
          guest_stays.status,
          guest_stays.payment_status,
          guest_stays.arrived_at,
          guest_stays.departed_at,
          host.full_name AS host_name,
          rooms.label AS host_room_label,
          blocks.code AS block_code
        FROM guest_stays
        JOIN users AS host ON host.id = guest_stays.host_resident_id
        JOIN residents ON residents.user_id = guest_stays.host_resident_id
        JOIN rooms ON rooms.id = residents.room_id
        JOIN blocks ON blocks.id = rooms.block_id
        ORDER BY guest_stays.guest_start_date, guest_stays.guest_name, guest_stays.id
        """
    ).fetchall()
    for row in guests:
        bucket = derive_bucket(
            status=row["status"],
            payment_status=row["payment_status"],
            start_date=row["guest_start_date"],
            end_date=row["guest_end_date"],
            arrived_at=row["arrived_at"],
            departed_at=row["departed_at"],
            today=today,
        )
        item = _empty_row()
        item.update(
            {
                "record_type": "guest",
                "block_code": row["block_code"],
                "guest_name": row["guest_name"],
                "relation": row["relation"],
                "host_name": row["host_name"],
                "host_room_label": row["host_room_label"],
                "guest_start_date": row["guest_start_date"],
                "guest_end_date": row["guest_end_date"],
                "payment_status": row["payment_status"],
                "guest_bucket": bucket,
                "arrived_at": row["arrived_at"] or "",
                "departed_at": row["departed_at"] or "",
            }
        )
        _write_row(writer, item)

    return buffer.getvalue()


@router.get("/register/export")
def export_register(
    _account: ProvostDep,
    connection: ConnectionDep,
) -> Response:
    body = build_register_csv(connection)
    return Response(
        content=body,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="register.csv"'},
    )
