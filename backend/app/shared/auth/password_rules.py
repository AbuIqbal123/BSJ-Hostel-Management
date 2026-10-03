"""Password classes and the Indian mobile used on resident self-onboard.

One rule for a new password on onboard, change-password, and the provost
reset. One rule for the resident phone and the guardian phone on onboard.
"""

from __future__ import annotations

import re
from typing import Annotated

from pydantic import AfterValidator, Field
from pydantic_core import PydanticCustomError

PASSWORD_CLASSES_MESSAGE = (
    "Include an uppercase letter, a lowercase letter, a number, and a symbol."
)
# Same pattern as OpenAPI. Pydantic's engine has no lookaheads, so the model
# checks it here after min_length.
PASSWORD_CLASS_PATTERN = (
    r"^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).+$"
)
_PASSWORD_CLASSES = re.compile(PASSWORD_CLASS_PATTERN)

INDIAN_MOBILE_MESSAGE = "Use an Indian mobile: +91 and exactly 10 digits."
INDIAN_MOBILE_PATTERN = r"^\+91[0-9]{10}$"


def _require_password_classes(value: str) -> str:
    if _PASSWORD_CLASSES.fullmatch(value) is None:
        raise PydanticCustomError("password_classes", PASSWORD_CLASSES_MESSAGE)
    return value


StrongPassword = Annotated[
    str,
    Field(min_length=10, max_length=200),
    AfterValidator(_require_password_classes),
]

IndianMobile = Annotated[str, Field(pattern=INDIAN_MOBILE_PATTERN)]
