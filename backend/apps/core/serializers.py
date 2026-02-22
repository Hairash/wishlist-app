from rest_framework import serializers

from apps.core.models import Comment, Reservation, WishlistItem


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
        ]

    def get_reservation(self, obj: WishlistItem):
        reservation = getattr(obj, "reservation", None)
        if not reservation or not obj.reservations_visible_public:
            return None
        return ReservationSerializer(reservation).data


class WishlistItemAdminSerializer(serializers.ModelSerializer):
    reservation = ReservationSerializer(read_only=True)

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
        ]
        read_only_fields = ["id", "created_at", "updated_at", "reservation"]


class ReserveItemInputSerializer(serializers.Serializer):
    reserved_by_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )


class CommentCreateSerializer(serializers.Serializer):
    author_name = serializers.CharField(
        max_length=255, required=False, allow_blank=True
    )
    text = serializers.CharField(max_length=5000)
