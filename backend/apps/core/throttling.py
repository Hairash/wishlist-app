from rest_framework.throttling import AnonRateThrottle


class ReserveAnonRateThrottle(AnonRateThrottle):
    scope = "reserve"


class CommentAnonRateThrottle(AnonRateThrottle):
    scope = "comment"
