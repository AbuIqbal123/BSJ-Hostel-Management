"""One page for every list.

`limit` is 1 to 500 and defaults to 50. `offset` starts at 0. A route that
pages by cursor still takes this dependency and reads `page.limit`.
"""

from typing import Annotated

from fastapi import Depends, Query
from pydantic import BaseModel

PAGE_SIZE = 50
PAGE_MAX = 500


class Page(BaseModel):
    limit: int
    offset: int


def read_page(
    limit: Annotated[int, Query(ge=1, le=PAGE_MAX)] = PAGE_SIZE,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page:
    return Page(limit=limit, offset=offset)


PageDep = Annotated[Page, Depends(read_page)]
