"""Verification for Telegram Mini App `initData` (WebApp login).

https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
"""
import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

MAX_AGE_SECONDS = 24 * 60 * 60


def verify_init_data(init_data, bot_token):
    """Verify a raw `Telegram.WebApp.initData` string against `bot_token`.

    Returns the parsed `user` dict (id, first_name, language_code, ...) on
    success, or None if the signature is invalid, missing, or expired.
    """
    if not init_data or not bot_token:
        return None

    pairs = dict(parse_qsl(init_data, strict_parsing=True))
    received_hash = pairs.pop('hash', None)
    if not received_hash:
        return None

    data_check_string = '\n'.join(f'{k}={v}' for k, v in sorted(pairs.items()))
    secret_key = hmac.new(b'WebAppData', bot_token.encode(), hashlib.sha256).digest()
    computed_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(computed_hash, received_hash):
        return None

    try:
        auth_date = int(pairs.get('auth_date', 0))
    except ValueError:
        return None
    if time.time() - auth_date > MAX_AGE_SECONDS:
        return None

    user_raw = pairs.get('user')
    if not user_raw:
        return None
    try:
        return json.loads(user_raw)
    except (TypeError, ValueError):
        return None
