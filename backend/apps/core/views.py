import hmac
import os

from django.core.files.storage import default_storage
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import Comment, Reservation, WishlistItem
from apps.core.permissions import HasAdminPassword
from apps.core.serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    ReserveItemInputSerializer,
    WishlistItemAdminSerializer,
    WishlistItemPublicSerializer,
)
from apps.core.throttling import CommentAnonRateThrottle, ReserveAnonRateThrottle


def error_response(message: str, status_code: int):
    return Response(
        {"error": {"status_code": status_code, "errors": {"detail": message}}},
        status=status_code,
    )


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"})


class AdminSessionView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response(
            {"is_authenticated": request.session.get("is_admin_authenticated") is True}
        )

    def post(self, request):
        configured_password = os.environ.get("ADMIN_PASSWORD", "")
        provided_password = request.data.get("password", "")

        if not configured_password or not hmac.compare_digest(
            provided_password, configured_password
        ):
            return error_response(
                "Invalid admin password.",
                status.HTTP_401_UNAUTHORIZED,
            )

        request.session.cycle_key()
        request.session["is_admin_authenticated"] = True
        request.session.save()
        return Response({"is_authenticated": True})

    def delete(self, request):
        request.session.pop("is_admin_authenticated", None)
        request.session.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistItemsPublicView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        queryset = WishlistItem.objects.filter(is_visible_public=True).select_related(
            "reservation"
        )
        serializer = WishlistItemPublicSerializer(queryset, many=True)
        return Response(serializer.data)


class ReserveItemView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [ReserveAnonRateThrottle]

    def post(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id, is_visible_public=True)
        serializer = ReserveItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data

        try:
            with transaction.atomic():
                _reservation, created = Reservation.objects.get_or_create(
                    item=item,
                    defaults={"reserved_by_name": payload.get("reserved_by_name", "")},
                )
        except IntegrityError:
            created = False
            Reservation.objects.get(item=item)

        if not created:
            return error_response(
                "Item is already reserved.",
                status.HTTP_409_CONFLICT,
            )

        response_data = WishlistItemPublicSerializer(
            WishlistItem.objects.select_related("reservation").get(pk=item.id)
        ).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class ItemCommentsView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [CommentAnonRateThrottle]

    def get(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id, is_visible_public=True)
        comments = item.comments.all()
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    def post(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id, is_visible_public=True)
        if not item.comments_enabled:
            return error_response(
                "Comments are disabled for this item.",
                status.HTTP_403_FORBIDDEN,
            )

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = Comment.objects.create(item=item, **serializer.validated_data)
        output = CommentSerializer(comment)
        return Response(output.data, status=status.HTTP_201_CREATED)


class AdminWishlistItemsView(APIView):
    permission_classes = [HasAdminPassword]

    def get(self, request):
        queryset = WishlistItem.objects.all()
        serializer = WishlistItemAdminSerializer(queryset, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = WishlistItemAdminSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        output = WishlistItemAdminSerializer(item)
        return Response(output.data, status=status.HTTP_201_CREATED)


class AdminWishlistItemDetailView(APIView):
    permission_classes = [HasAdminPassword]

    def patch(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id)
        serializer = WishlistItemAdminSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminWishlistItemImagesUploadView(APIView):
    permission_classes = [HasAdminPassword]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id)
        files = request.FILES.getlist("images")
        if not files:
            return error_response("Please provide at least one image file.", 400)

        metadata = item.metadata if isinstance(item.metadata, dict) else {}
        existing_images = metadata.get("images", [])
        if not isinstance(existing_images, list):
            existing_images = []

        if len(existing_images) + len(files) > 5:
            return error_response(
                "You can attach at most 5 images per item.",
                status.HTTP_400_BAD_REQUEST,
            )

        uploaded_urls = []
        for upload in files:
            if not (upload.content_type or "").startswith("image/"):
                return error_response(
                    "Only image files are allowed.",
                    status.HTTP_400_BAD_REQUEST,
                )
            file_path = default_storage.save(
                f"wishlist-images/{item.id}/{upload.name}",
                upload,
            )
            uploaded_urls.append(
                request.build_absolute_uri(default_storage.url(file_path))
            )

        item.metadata = {**metadata, "images": [*existing_images, *uploaded_urls]}
        item.save(update_fields=["metadata", "updated_at"])
        serializer = WishlistItemAdminSerializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)
