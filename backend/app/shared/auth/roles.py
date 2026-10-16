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
ADMIN: frozenset[Role] = frozenset({"provost"})


def require_roles(allowed: frozenset[Role]):
    """The signed-in account must be one of `allowed`."""
    from app.shared.auth.routes import Account, AccountDep
    from app.shared.errors import ApiError

    def checker(account: AccountDep) -> Account:
        if account.role not in allowed:
            raise ApiError(403, "forbidden", "This account cannot do that.")
        return account

    return checker
