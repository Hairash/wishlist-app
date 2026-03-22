from rest_framework import serializers

from apps.core.action_cookies import user_can_undo_comment, user_can_undo_reservation
from apps.core.models import Comment, Reservation, WishlistItem
from apps.core.validators import (
    validate_markdown_content,
    validate_metadata_images,
    validate_metadata_links,
)


class ReservationSerializer(serializers.ModelSerializer):
    can_undo = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = ["id", "reserved_by_name", "created_at", "can_undo"]
        read_only_fields = ["created_at"]

    def get_can_undo(self, obj: Reservation) -> bool:
        request = self.context.get("request")
        return bool(request and user_can_undo_reservation(request, obj.id))


class CommentSerializer(serializers.ModelSerializer):
    can_undo = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = ["id", "author_name", "text", "created_at", "can_undo"]
        read_only_fields = ["id", "created_at"]

    def get_can_undo(self, obj: Comment) -> bool:
        request = self.context.get("request")
        return bool(request and user_can_undo_comment(request, obj.id))


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
        return ReservationSerializer(reservation, context=self.context).data

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
