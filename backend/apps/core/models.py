from django.db import models


class WishlistItem(models.Model):
    title = models.CharField(max_length=255)
    content_markdown = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_visible_public = models.BooleanField(default=True)
    reservations_visible_public = models.BooleanField(default=True)
    comments_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.title


class Reservation(models.Model):
    item = models.OneToOneField(
        WishlistItem,
        on_delete=models.CASCADE,
        related_name="reservation",
    )
    reserved_by_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class Comment(models.Model):
    item = models.ForeignKey(
        WishlistItem,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author_name = models.CharField(max_length=255, blank=True)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
