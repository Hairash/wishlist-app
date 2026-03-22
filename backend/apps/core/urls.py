from django.urls import path
from rest_framework.schemas import get_schema_view

from apps.core.views import (
    AdminSessionView,
    AdminWishlistItemDetailView,
    AdminWishlistItemImagesUploadView,
    AdminWishlistItemsView,
    HealthCheckView,
    ItemCommentDetailView,
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
        "wishlist-items/<int:item_id>/comments/<int:comment_id>/",
        ItemCommentDetailView.as_view(),
        name="wishlist-item-comment-detail",
    ),
    path("admin/session/", AdminSessionView.as_view(), name="admin-session"),
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
        "admin/wishlist-items/<int:item_id>/images/",
        AdminWishlistItemImagesUploadView.as_view(),
        name="admin-item-images-upload",
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
