import os

import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.core.models import Comment, Reservation, WishlistItem


@pytest.mark.django_db
def test_healthcheck() -> None:
    client = APIClient()
    response = client.get("/api/health/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.django_db
def test_reservation_is_persisted_and_visible() -> None:
    item = WishlistItem.objects.create(
        title="Coffee grinder",
        content_markdown="Great for espresso.",
        reservations_visible_public=True,
    )
    client = APIClient()

    reserve_response = client.post(
        f"/api/wishlist-items/{item.id}/reserve/",
        {"reserved_by_name": "Alex"},
        format="json",
    )

    assert reserve_response.status_code == 201
    assert Reservation.objects.filter(item=item, reserved_by_name="Alex").exists()

    list_response = client.get("/api/wishlist-items/")
    assert list_response.status_code == 200
    assert list_response.json()[0]["reservation"]["reserved_by_name"] == "Alex"


@pytest.mark.django_db
def test_reservation_can_only_be_created_once() -> None:
    item = WishlistItem.objects.create(title="Headphones")
    client = APIClient()

    first = client.post(
        f"/api/wishlist-items/{item.id}/reserve/",
        {"reserved_by_name": "First"},
        format="json",
    )
    second = client.post(
        f"/api/wishlist-items/{item.id}/reserve/",
        {"reserved_by_name": "Second"},
        format="json",
    )

    assert first.status_code == 201
    assert second.status_code == 409
    assert Reservation.objects.filter(item=item).count() == 1


@pytest.mark.django_db
def test_comments_creation_and_listing() -> None:
    item = WishlistItem.objects.create(title="Books")
    client = APIClient()

    create_response = client.post(
        f"/api/wishlist-items/{item.id}/comments/",
        {"author_name": "Mila", "text": "Love this pick"},
        format="json",
    )

    assert create_response.status_code == 201
    assert Comment.objects.filter(item=item, text="Love this pick").exists()

    list_response = client.get(f"/api/wishlist-items/{item.id}/comments/")
    assert list_response.status_code == 200
    assert list_response.json() == [
        {
            "id": create_response.json()["id"],
            "author_name": "Mila",
            "text": "Love this pick",
            "created_at": create_response.json()["created_at"],
        }
    ]


@pytest.mark.django_db
def test_admin_crud_requires_password_or_authenticated_session() -> None:
    item = WishlistItem.objects.create(title="Tripod")
    client = APIClient()

    with override_settings(DEBUG=True):
        os.environ["ADMIN_PASSWORD"] = "super-secret"

        unauthorized = client.get("/api/admin/wishlist-items/")

        login_response = client.post(
            "/api/admin/session/",
            {"password": "super-secret"},
            format="json",
        )
        session_authorized = client.get("/api/admin/wishlist-items/")

        header_authorized = client.get(
            "/api/admin/wishlist-items/",
            HTTP_X_ADMIN_PASSWORD="super-secret",
        )

        create_response = client.post(
            "/api/admin/wishlist-items/",
            {
                "title": "New camera",
                "content_markdown": "**Mirrorless**",
                "metadata": {"links": ["https://example.com"]},
            },
            format="json",
        )

        update_response = client.patch(
            f"/api/admin/wishlist-items/{item.id}/",
            {"content_markdown": "Updated"},
            format="json",
        )

        logout_response = client.delete("/api/admin/session/")
        after_logout = client.get("/api/admin/wishlist-items/")

    assert unauthorized.status_code == 403
    assert login_response.status_code == 200
    assert session_authorized.status_code == 200
    assert header_authorized.status_code == 200
    assert create_response.status_code == 201
    assert "reservation" not in create_response.json()
    assert update_response.status_code == 200
    assert logout_response.status_code == 204
    assert after_logout.status_code == 403
