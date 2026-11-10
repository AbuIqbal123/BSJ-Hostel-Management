"""Who may call a route. One role type, and the sets the hall already uses.

Annotations stay evaluated here. FastAPI reads them off the dependency, and a
string annotation would be resolved from this module before the import inside
require_roles has run.
"""

from typing import Literal

Role = Literal["resident", "gate", "warden", "provost"]

RESIDENT: frozenset[Role] = frozenset({"resident"})
GATE: frozenset[Role] = frozenset({"gate", "warden", "provost"})
REGISTER: frozenset[Role] = frozenset({"warden", "provost"})
SETTINGS: frozenset[Role] = frozenset({"provost"})


def can_suspend(actor_role: str) -> bool:
    """Only the provost may suspend or reinstate an account."""
    return actor_role == "provost"


def can_act_on_target(actor_role: str, target_role: str) -> bool:
    """A warden may not create or take over a provost."""
    if actor_role == "provost":
        return True
    return target_role != "provost"


def require_roles(allowed: frozenset[Role]):
    """The signed-in account must be one of `allowed`."""
    from app.shared.auth.routes import Account, AccountDep
    from app.shared.errors import ApiError

    def checker(account: AccountDep) -> Account:
        if account.role not in allowed:
            raise ApiError(403, "forbidden", "This account cannot do that.")
        return account

    return checker
