"""
Django settings for pawtrack project.
"""
import os
import sys
from pathlib import Path
from celery.schedules import crontab

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent
DEDUP_MODELS_DIR = os.environ.get('DEDUP_MODELS_DIR', os.path.join(BASE_DIR, 'deduplicacion', 'ml_models'))

# SECURITY WARNING: keep the secret key used in production secret!
# Lee la llave del .env, si no hay (en local), usa una por defecto
SECRET_KEY = os.environ.get('SECRET_KEY', 'clave-insegura-de-desarrollo')

# Solo será True si en el .env dice explícitamente "True"
DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# Lee las IPs permitidas separadas por comas desde el .env
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')

# Application definition
INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.gis',
    'rest_framework',
    'channels',
    'corsheaders',          # ← corregido (era 'coresheaders')
    'bd',
    'django.contrib.sites',
    'allauth',
    'allauth.account',
    'allauth.socialaccount',
    'allauth.socialaccount.providers.google',
    'rest_framework.authtoken',
    'dj_rest_auth',
    'dj_rest_auth.registration',
    'rest_framework_simplejwt',
    'core',
    'rescates',
    'notificaciones',
    'deduplicacion',
    'recursos',
    'centros',
    'django_celery_beat',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',    # ← debe ser PRIMERO
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'allauth.account.middleware.AccountMiddleware',
]

ROOT_URLCONF = 'pawtrack.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'pawtrack.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.contrib.gis.db.backends.postgis',
        'NAME': os.environ["DB_NAME"],
        'USER': os.environ["DB_USER"],
        'PASSWORD': os.environ["DB_PASSWORD"],
        'HOST': os.environ["DB_HOST"],
        'PORT': os.environ["DB_PORT"]
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles') # <-- ¡AGREGA ESTA LÍNEA!
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Cache (Redis) — usado por deduplicacion.services.VisionService.aprender_embedding()
# para el lock real (cache.lock()) que protege la escritura del índice HNSW
# compartido. LocMemCache (el default de Django) no implementa .lock(), así
# que hace falta un backend real aquí, no solo para Celery/Channels.
CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': os.environ.get('DJANGO_CACHE_URL', 'redis://redis:6379/2'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
        },
    },
}

# ASGI / Channels
ASGI_APPLICATION = 'pawtrack.asgi.application'
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            "hosts": [os.environ.get('REDIS_URL', 'redis://redis:6379/1')],
        },
    },
}

AUTH_USER_MODEL = 'bd.Usuario'

# Media files (imágenes subidas)
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Allauth
SITE_ID = 1

# JWT
from datetime import timedelta

INSTALLED_APPS += ['rest_framework_simplejwt.token_blacklist']

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin-allow-popups'

SOCIALACCOUNT_ADAPTER = 'bd.adapters.CustomSocialAccountAdapter'
SOCIALACCOUNT_EMAIL_VERIFICATION = 'none'
SOCIALACCOUNT_PROVIDERS = {
    'google': {
        'APP': {
            'client_id': os.environ.get('GOOGLE_CLIENT_ID', ''),
            'secret': os.environ.get('GOOGLE_CLIENT_SECRET', ''),
            'key': ''
        },
        'SCOPE': ['profile', 'email'],
        'AUTH_PARAMS': {'access_type': 'online'},
    }
}

THROTTLE_RATES = {
    'anon': '10/minute',
    'user': '1000/day',
    'pdf_import': '5/minute',
    'vision_anon': '10/minute',
    # §10: máximo 5 reportes por hora y por usuario.
    'crear_reporte': '5/hour',
    # §10 pide 5 intentos por cada 15 minutos, pero DRF solo entiende
    # second/minute/hour/day. 20/hora es el equivalente más cercano y
    # frena igual la fuerza bruta.
    'login': '20/hour',
}

# La suite comparte Redis para probar locks de deduplicacion, pero no debe
# compartir el limite de 10 requests anonimos entre casos de prueba aislados.
if 'test' in sys.argv:
    THROTTLE_RATES['anon'] = '100000/minute'

REST_FRAMEWORK = {
    'NUM_PROXIES': 1,
    'EXCEPTION_HANDLER': 'core.exceptions.pawtrack_exception_handler',
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),

    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',  # Protege tu API de ataques de fuerza bruta
        'user': '1000/day',
	'vision_anon': '10/minute'
    }
}

REST_AUTH = {
    'USE_JWT': True,
    'SESSION_LOGIN': False,
    'USER_DETAILS_SERIALIZER': 'bd.serializers.UsuarioSerializer',
    'REGISTER_SERIALIZER': 'bd.serializers.CustomRegisterSerializer',
}

ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_LOGIN_METHODS = {'email'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'password1*', 'password2*']
ACCOUNT_EMAIL_VERIFICATION = 'none'

AUTHENTICATION_BACKENDS = [
    'allauth.account.auth_backends.AuthenticationBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# CORS — definido UNA sola vez
CORS_ALLOWED_ORIGINS = [
    "http://localhost:8100",
    "http://localhost:4200",
    "https://pawtrack.me",
    "https://www.pawtrack.me",
]

CORS_ALLOW_METHODS = [
    "DELETE",
    "GET",
    "OPTIONS",
    "PATCH",
    "POST",
    "PUT",
]

CORS_ALLOW_HEADERS = [
    "accept",
    "authorization",
    "content-type",
    "origin",
    "x-requested-with",
]

CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://redis:6379/0')
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://redis:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_BEAT_SCHEDULE = {
    'recalc-urgency-score': {
        'task': 'notificaciones.tasks.recalc_urgency_score',
        'schedule': crontab(minute='*/30'),
    },
}

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_SSL_REDIRECT = False  # Nginx ya hace el redirect, no Django
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
CSRF_TRUSTED_ORIGINS = [
    "https://pawtrack.me",
    "https://www.pawtrack.me",
]
