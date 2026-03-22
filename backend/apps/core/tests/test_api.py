import os

import pytest
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
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
    assert second.json()["error"]["errors"]["detail"] == "Item is already reserved."
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
def test_admin_crud_requires_authenticated_session() -> None:
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
    assert "error" in unauthorized.json()
    assert login_response.status_code == 200
    assert session_authorized.status_code == 200
    assert create_response.status_code == 201
    assert "reservation" not in create_response.json()
    assert update_response.status_code == 200
    assert logout_response.status_code == 204
    assert after_logout.status_code == 403


@pytest.mark.django_db
def test_admin_session_status_is_false_without_session() -> None:
    client = APIClient()

    with override_settings(DEBUG=True):
        os.environ["ADMIN_PASSWORD"] = "super-secret"
        response = client.get("/api/admin/session/")

    assert response.status_code == 200
    assert response.json() == {"is_authenticated": False}


@pytest.mark.django_db
def test_admin_item_rejects_raw_html_in_markdown() -> None:
    client = APIClient()

    with override_settings(DEBUG=True):
        os.environ["ADMIN_PASSWORD"] = "super-secret"
        client.post(
            "/api/admin/session/",
            {"password": "super-secret"},
            format="json",
        )

        response = client.post(
            "/api/admin/wishlist-items/",
            {"title": "X", "content_markdown": "<script>alert(1)</script>"},
            format="json",
        )

    assert response.status_code == 400
    assert "error" in response.json()


@pytest.mark.django_db
def test_admin_item_rejects_javascript_links_in_metadata() -> None:
    client = APIClient()

    with override_settings(DEBUG=True):
        os.environ["ADMIN_PASSWORD"] = "super-secret"
        client.post(
            "/api/admin/session/",
            {"password": "super-secret"},
            format="json",
        )

        response = client.post(
            "/api/admin/wishlist-items/",
            {
                "title": "X",
                "metadata": {"links": ["javascript:alert(1)"]},
            },
            format="json",
        )

    assert response.status_code == 400
    assert "error" in response.json()


@pytest.mark.django_db
def test_comment_rejects_raw_html_payload() -> None:
    item = WishlistItem.objects.create(title="Books")
    client = APIClient()

    response = client.post(
        f"/api/wishlist-items/{item.id}/comments/",
        {"text": "<img src=x onerror=alert(1)>"},
        format="json",
    )

    assert response.status_code == 400
    assert "error" in response.json()


@pytest.mark.django_db
def test_reserve_endpoint_is_rate_limited() -> None:
    item1 = WishlistItem.objects.create(title="A")
    item2 = WishlistItem.objects.create(title="B")
    client = APIClient()

    with override_settings(
        REST_FRAMEWORK={
            "EXCEPTION_HANDLER": "apps.core.exceptions.wishlist_exception_handler",
            "DEFAULT_THROTTLE_CLASSES": [],
            "DEFAULT_THROTTLE_RATES": {"reserve": "1/min", "comment": "20/hour"},
        }
    ):
        cache.clear()
        first = client.post(
            f"/api/wishlist-items/{item1.id}/reserve/",
            {},
            format="json",
        )
        second = client.post(
            f"/api/wishlist-items/{item2.id}/reserve/",
            {},
            format="json",
        )

    assert first.status_code == 201
    assert second.status_code == 429
    assert "error" in second.json()


@pytest.mark.django_db
def test_comment_endpoint_is_rate_limited() -> None:
    item = WishlistItem.objects.create(title="A")
    client = APIClient()

    with override_settings(
        REST_FRAMEWORK={
            "EXCEPTION_HANDLER": "apps.core.exceptions.wishlist_exception_handler",
            "DEFAULT_THROTTLE_CLASSES": [],
            "DEFAULT_THROTTLE_RATES": {"reserve": "10/hour", "comment": "1/min"},
        }
    ):
        cache.clear()
        first = client.post(
            f"/api/wishlist-items/{item.id}/comments/",
            {"text": "first"},
            format="json",
        )
        second = client.post(
            f"/api/wishlist-items/{item.id}/comments/",
            {"text": "second"},
            format="json",
        )

    assert first.status_code == 201
    assert second.status_code == 429
    assert "error" in second.json()


@pytest.mark.django_db
def test_admin_can_upload_item_images_and_persist_metadata(tmp_path) -> None:
    item = WishlistItem.objects.create(title="Camera")
    client = APIClient()

    with override_settings(DEBUG=True, MEDIA_ROOT=tmp_path):
        os.environ["ADMIN_PASSWORD"] = "super-secret"
        client.post(
            "/api/admin/session/",
            {"password": "super-secret"},
            format="json",
        )
        image_file = SimpleUploadedFile(
            "photo.jpg",
            b"fake-jpg-content",
            content_type="image/jpeg",
        )
        response = client.post(
            f"/api/admin/wishlist-items/{item.id}/images/",
            {"images": [image_file]},
            format="multipart",
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["metadata"]["images"]) == 1
    assert "/media/wishlist-images/" in payload["metadata"]["images"][0]


@pytest.mark.django_db
def test_admin_can_upload_item_images_without_persisting_metadata(tmp_path) -> None:
    item = WishlistItem.objects.create(
        title="Camera",
        metadata={"links": ["https://example.com"]},
    )
    client = APIClient()

    with override_settings(DEBUG=True, MEDIA_ROOT=tmp_path):
        os.environ["ADMIN_PASSWORD"] = "super-secret"
        client.post(
            "/api/admin/session/",
            {"password": "super-secret"},
            format="json",
        )
        image_file = SimpleUploadedFile(
            "photo.jpg",
            b"fake-jpg-content",
            content_type="image/jpeg",
        )
        response = client.post(
            f"/api/admin/wishlist-items/{item.id}/images/",
            {
                "images": [image_file],
                "persist_metadata": "false",
                "existing_image_count": "0",
            },
            format="multipart",
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["urls"]) == 1
    assert "/media/wishlist-images/" in payload["urls"][0]
    item.refresh_from_db()
    assert item.metadata == {"links": ["https://example.com"]}


@pytest.mark.django_db
def test_admin_image_upload_rejects_more_than_five_images(tmp_path) -> None:
    item = WishlistItem.objects.create(
        title="Speaker",
        metadata={
            "images": [f"https://example.com/image-{idx}.jpg" for idx in range(5)]
        },
    )
    client = APIClient()

    with override_settings(DEBUG=True, MEDIA_ROOT=tmp_path):
        os.environ["ADMIN_PASSWORD"] = "super-secret"
        client.post(
            "/api/admin/session/",
            {"password": "super-secret"},
            format="json",
        )
        image_file = SimpleUploadedFile(
            "overflow.jpg",
            b"fake-jpg-content",
            content_type="image/jpeg",
        )
        response = client.post(
            f"/api/admin/wishlist-items/{item.id}/images/",
            {"images": [image_file]},
            format="multipart",
        )

    assert response.status_code == 400
    assert (
        response.json()["error"]["errors"]["detail"]
        == "You can attach at most 5 images per item."
    )
