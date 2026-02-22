from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
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


class HealthCheckView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response({"status": "ok"})


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

    def post(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id, is_visible_public=True)
        serializer = ReserveItemInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data

        try:
            with transaction.atomic():
                reservation, created = Reservation.objects.get_or_create(
                    item=item,
                    defaults={"reserved_by_name": payload.get("reserved_by_name", "")},
                )
        except IntegrityError:
            created = False
            Reservation.objects.get(item=item)

        if not created:
            return Response(
                {"detail": "Item is already reserved."},
                status=status.HTTP_409_CONFLICT,
            )

        response_data = WishlistItemPublicSerializer(
            WishlistItem.objects.select_related("reservation").get(pk=item.id)
        ).data
        return Response(response_data, status=status.HTTP_201_CREATED)


class ItemCommentsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id, is_visible_public=True)
        comments = item.comments.all()
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    def post(self, request, item_id: int):
        item = get_object_or_404(WishlistItem, pk=item_id, is_visible_public=True)
        if not item.comments_enabled:
            return Response(
                {"detail": "Comments are disabled for this item."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CommentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        comment = Comment.objects.create(item=item, **serializer.validated_data)
        output = CommentSerializer(comment)
        return Response(output.data, status=status.HTTP_201_CREATED)


class AdminWishlistItemsView(APIView):
    permission_classes = [HasAdminPassword]

    def get(self, request):
        queryset = WishlistItem.objects.all().select_related("reservation")
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
