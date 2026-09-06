# Railway backend image. Root Directory = backend/, so this build context is
# just this folder — unlike deploy/backend.Dockerfile (used by the Oracle/
# docker-compose path), which builds from the repo root instead.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# No DB connection needed for collectstatic (whitenoise manifest storage).
RUN python manage.py collectstatic --noinput

EXPOSE 8000

# Railway injects $PORT at runtime — must bind to it, not a hardcoded port.
CMD python manage.py migrate --noinput && \
    gunicorn backend.wsgi:application --bind 0.0.0.0:${PORT:-8000} --workers 3
