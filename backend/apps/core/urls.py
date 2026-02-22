from django.urls import path
from rest_framework.schemas import get_schema_view

from apps.core.views import (
    AdminWishlistItemDetailView,
    AdminWishlistItemsView,
    HealthCheckView,
    ItemCommentsView,
    ReserveItemView,
    WishlistItemsPublicView,
)

urlpatterns = [
    path("health/", HealthCheckView.as_view(), name="health-check"),
    path(
        "wishlist-items/", WishlistItemsPublicView.as_view(), name="wishlist-items-list"
    ),
    path(
        "wishlist-items/<int:item_id>/reserve/",
        ReserveItemView.as_view(),
        name="wishlist-item-reserve",
    ),
    path(
        "wishlist-items/<int:item_id>/comments/",
        ItemCommentsView.as_view(),
        name="wishlist-item-comments",
    ),
    path(
        "admin/wishlist-items/",
        AdminWishlistItemsView.as_view(),
        name="admin-items-list",
    ),
    path(
        "admin/wishlist-items/<int:item_id>/",
        AdminWishlistItemDetailView.as_view(),
        name="admin-item-detail",
    ),
    path(
        "schema/",
        get_schema_view(
            title="Wishlist API",
            description="Step 2 API for wishlist public/admin interactions",
            version="1.0.0",
            public=True,
        ),
        name="openapi-schema",
    ),
]
