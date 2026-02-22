from rest_framework.views import exception_handler


def wishlist_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is None:
        return response

    detail = response.data
    errors = detail if isinstance(detail, (dict, list)) else {"detail": detail}
    response.data = {
        "error": {
            "status_code": response.status_code,
            "errors": errors,
        }
    }
    return response
