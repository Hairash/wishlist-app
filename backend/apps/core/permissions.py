from rest_framework.permissions import BasePermission


class HasAdminPassword(BasePermission):
    message = "Admin authentication required"

    def has_permission(self, request, view) -> bool:
        return request.session.get("is_admin_authenticated") is True
