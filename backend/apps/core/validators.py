import re
from typing import Any

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import URLValidator
from rest_framework import serializers

HTML_TAG_RE = re.compile(r"<[^>]+>")
DANGEROUS_PROTOCOL_RE = re.compile(r"(?:javascript|data|vbscript)\s*:", re.IGNORECASE)


url_validator = URLValidator(schemes=["http", "https"])


def validate_markdown_content(value: str) -> str:
    if HTML_TAG_RE.search(value):
        raise serializers.ValidationError(
            "Markdown content cannot contain raw HTML tags."
        )

    if DANGEROUS_PROTOCOL_RE.search(value):
        raise serializers.ValidationError(
            "Markdown content includes a blocked URL protocol."
        )

    return value


def validate_metadata_links(metadata: dict[str, Any]) -> dict[str, Any]:
    links = metadata.get("links")
    if links is None:
        return metadata

    if not isinstance(links, list):
        raise serializers.ValidationError({"links": "Links must be a list."})

    for link in links:
        if not isinstance(link, str):
            raise serializers.ValidationError(
                {"links": "Each link must be a string URL."}
            )

        if DANGEROUS_PROTOCOL_RE.search(link):
            raise serializers.ValidationError(
                {"links": "Blocked URL protocol detected."}
            )

        try:
            url_validator(link)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"links": f"Invalid URL: {link}"}
            ) from exc

    return metadata


def validate_metadata_images(metadata: dict[str, Any]) -> dict[str, Any]:
    images = metadata.get("images")
    if images is None:
        return metadata

    if not isinstance(images, list):
        raise serializers.ValidationError({"images": "Images must be a list."})

    if len(images) > 5:
        raise serializers.ValidationError(
            {"images": "You can attach at most 5 images per item."}
        )

    for image_url in images:
        if not isinstance(image_url, str):
            raise serializers.ValidationError(
                {"images": "Each image must be a string URL."}
            )

        if DANGEROUS_PROTOCOL_RE.search(image_url):
            raise serializers.ValidationError(
                {"images": "Blocked URL protocol detected."}
            )

        try:
            url_validator(image_url)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                {"images": f"Invalid image URL: {image_url}"}
            ) from exc

    return metadata
