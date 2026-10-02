import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / ".env")

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "dev-only-change-me-before-deploying").strip()
DEBUG = os.getenv("DJANGO_DEBUG", "true").strip().lower() in {"1", "true", "yes"}
_render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "")
_allowed_hosts = os.getenv("DJANGO_ALLOWED_HOSTS", _render_host or "127.0.0.1,localhost")
ALLOWED_HOSTS = [host.strip() for host in _allowed_hosts.split(",") if host.strip()]
CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()]

if not DEBUG:
    if SECRET_KEY == "dev-only-change-me-before-deploying" or len(SECRET_KEY) < 40:
        raise RuntimeError("Configurá DJANGO_SECRET_KEY con una clave aleatoria de al menos 40 caracteres.")
    if not ALLOWED_HOSTS:
        raise RuntimeError("Configurá DJANGO_ALLOWED_HOSTS con los dominios del backend.")
    if all(host in {"localhost", "127.0.0.1", "::1"} for host in ALLOWED_HOSTS):
        raise RuntimeError("DJANGO_ALLOWED_HOSTS debe incluir el dominio público del backend en producción.")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt",
    "cloudinary",
    "store",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": dj_database_url.config(
        default=os.getenv("DATABASE_URL") or f"sqlite:///{(BASE_DIR / 'db.sqlite3').as_posix()}",
        conn_max_age=600,
    )
}
if not DEBUG and DATABASES["default"]["ENGINE"].endswith("sqlite3"):
    raise RuntimeError("Configurá DATABASE_URL con una base PostgreSQL persistente antes de iniciar en producción.")

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "es-ar"
TIME_ZONE = "America/Argentina/Buenos_Aires"
USE_I18N = True
USE_TZ = True
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_URL", "http://localhost:3000,http://127.0.0.1:3000").split(",")
    if origin.strip()
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    regex.strip() for regex in os.getenv("CORS_ALLOWED_ORIGIN_REGEXES", "").split(",") if regex.strip()
]
if not DEBUG:
    if any(not origin.startswith("https://") for origin in CORS_ALLOWED_ORIGINS):
        raise RuntimeError("En producción, FRONTEND_URL debe contener únicamente orígenes HTTPS públicos.")
    if not CORS_ALLOWED_ORIGIN_REGEXES:
        raise RuntimeError("Configurá CORS_ALLOWED_ORIGIN_REGEXES con el dominio público del frontend.")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["rest_framework_simplejwt.authentication.JWTAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_THROTTLE_RATES": {
        "solicitud_atencion": "10/hour",
        "registro": "5/hour",
        "login": "10/minute",
        "pago_retorno": "30/hour",
    },
}

if not DEBUG and os.getenv("MP_ENABLED", "false").strip().lower() == "true":
    mp_access_token = os.getenv("MP_ACCESS_TOKEN", "").strip()
    if not mp_access_token or mp_access_token.startswith("TU_"):
        raise RuntimeError("MP_ENABLED requiere configurar MP_ACCESS_TOKEN en producción.")
    mp_webhook_url = urlparse(os.getenv("MP_WEBHOOK_URL", "").strip())
    if (
        mp_webhook_url.scheme != "https"
        or not mp_webhook_url.hostname
        or mp_webhook_url.path.rstrip("/") != "/pagos/webhook"
        or not os.getenv("MP_WEBHOOK_SECRET", "").strip()
    ):
        raise RuntimeError("Mercado Pago requiere MP_WEBHOOK_URL y MP_WEBHOOK_SECRET en producción.")

PEDIDO_RESERVA_MINUTOS = max(1, int(os.getenv("PEDIDO_RESERVA_MINUTOS", "1440")))

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"
    X_FRAME_OPTIONS = "DENY"
    SECURE_SSL_REDIRECT = os.getenv("DJANGO_SECURE_SSL_REDIRECT", "true").strip().lower() in {"1", "true", "yes"}
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_HSTS_SECONDS = int(os.getenv("DJANGO_SECURE_HSTS_SECONDS", "0"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = os.getenv("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", "false").lower() == "true"
    SECURE_HSTS_PRELOAD = os.getenv("DJANGO_SECURE_HSTS_PRELOAD", "false").lower() == "true"

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=12),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

EMAIL_BACKEND = os.getenv("EMAIL_BACKEND") or (
    "django.core.mail.backends.console.EmailBackend" if DEBUG else "django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "true").lower() == "true"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
DEFAULT_FROM_EMAIL = os.getenv("DEFAULT_FROM_EMAIL", "Ragnar Suplementos <noreply@localhost>")
