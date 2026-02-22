import hmac
import os

from rest_framework.permissions import BasePermission


class HasAdminPassword(BasePermission):
    message = "Admin authentication required"

    def has_permission(self, request, view) -> bool:
        configured_password = os.environ.get("ADMIN_PASSWORD", "")
        if not configured_password:
            return False

        provided_password = request.headers.get("X-Admin-Password", "")
        return hmac.compare_digest(provided_password, configured_password)
