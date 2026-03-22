from rest_framework import serializers

from apps.core.models import Comment, Reservation, WishlistItem
from apps.core.validators import (
    validate_markdown_content,
    validate_metadata_images,
    validate_metadata_links,
)


class ReservationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Reservation
        fields = ["reserved_by_name", "created_at"]
        read_only_fields = ["created_at"]


class CommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ["id", "author_name", "text", "created_at"]
        read_only_fields = ["id", "created_at"]


class WishlistItemPublicSerializer(serializers.ModelSerializer):
    reservation = serializers.SerializerMethodField()
    comments_count = serializers.SerializerMethodField()

    class Meta:
        model = WishlistItem
        fields = [
            "id",
            "title",
            "content_markdown",
            "metadata",
            "is_visible_public",
            "reservations_visible_public",
            "comments_enabled",
            "created_at",
            "updated_at",
            "reservation",
            "comments_count",
        ]

    def get_reservation(self, obj: WishlistItem):
        reservation = getattr(obj, "reservation", None)
        if not reservation or not obj.reservations_visible_public:
            return None
        return ReservationSerializer(reservation).data

    def get_comments_count(self, obj: WishlistItem):
        annotated_count = getattr(obj, "comments_count", None)
        if isinstance(annotated_count, int):
            return annotated_count
        return obj.comments.count()


class WishlistItemAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = WishlistItem
        fields = [
            "id",
            "title",
            "content_markdown",
            "metadata",
            "is_visible_public",
            "reservations_visible_public",
            "comments_enabled",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_content_markdown(self, value: str) -> str:
        return validate_markdown_content(value)

    def validate_metadata(self, value: dict) -> dict:
        value = validate_metadata_links(value)
        return validate_metadata_images(value)


class ReserveItemInputSerializer(serializers.Serializer):
    reserved_by_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )


class CommentCreateSerializer(serializers.Serializer):
    author_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    text = serializers.CharField(max_length=5000)

    def validate_text(self, value: str) -> str:
        return validate_markdown_content(value)
