from django.conf import settings
from rest_framework.throttling import AnonRateThrottle


class _SettingsRateAnonThrottle(AnonRateThrottle):
    default_rate = None

    def get_rate(self):
        rates = settings.REST_FRAMEWORK.get("DEFAULT_THROTTLE_RATES", {})
        return rates.get(self.scope, self.default_rate)


class ReserveAnonRateThrottle(_SettingsRateAnonThrottle):
    scope = "reserve"
    default_rate = "10/hour"


class CommentAnonRateThrottle(_SettingsRateAnonThrottle):
    scope = "comment"
    default_rate = "20/hour"
