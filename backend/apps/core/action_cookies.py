from __future__ import annotations

from django.conf import settings
from django.core import signing

COOKIE_NAME = "wishlist_actions"
COOKIE_SALT = "wishlist-actions"
COOKIE_MAX_AGE = 60 * 60 * 24 * 90


def _empty_actions() -> dict[str, list[int]]:
    return {"reservation_ids": [], "comment_ids": []}


def _to_int_list(values) -> list[int]:
    parsed = []
    for value in values:
        if isinstance(value, int):
            parsed.append(value)
        elif isinstance(value, str) and value.isdigit():
            parsed.append(int(value))
    return parsed


def read_actions_cookie(request) -> dict[str, list[int]]:
    raw_cookie = request.COOKIES.get(COOKIE_NAME)
    if not raw_cookie:
        return _empty_actions()

    try:
        payload = signing.loads(raw_cookie, salt=COOKIE_SALT)
    except signing.BadSignature:
        return _empty_actions()

    reservation_ids = payload.get("reservation_ids", [])
    comment_ids = payload.get("comment_ids", [])
    if not isinstance(reservation_ids, list) or not isinstance(comment_ids, list):
        return _empty_actions()

    return {
        "reservation_ids": _to_int_list(reservation_ids),
        "comment_ids": _to_int_list(comment_ids),
    }


def write_actions_cookie(response, actions: dict[str, list[int]]) -> None:
    encoded = signing.dumps(actions, salt=COOKIE_SALT)
    response.set_cookie(
        COOKIE_NAME,
        encoded,
        path="/",
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=settings.SESSION_COOKIE_SECURE,
        samesite=settings.SESSION_COOKIE_SAMESITE,
    )


def user_can_undo_reservation(request, reservation_id: int) -> bool:
    actions = read_actions_cookie(request)
    return reservation_id in actions["reservation_ids"]


def user_can_undo_comment(request, comment_id: int) -> bool:
    actions = read_actions_cookie(request)
    return comment_id in actions["comment_ids"]
