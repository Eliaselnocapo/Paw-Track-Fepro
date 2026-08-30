# ==========================================
# DOCKERFILE DE DESARROLLO — NO USAR EN PRODUCCIÓN
# Corre todo como root para evitar problemas de permisos con
# los bind mounts (./:/app) durante el desarrollo local.
# ==========================================

# ==========================================
# ETAPA 1: BUILDER
# ==========================================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    libpq-dev \
    gdal-bin \
    libgdal-dev \
    binutils \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

RUN pip install --default-timeout=1000 --no-cache-dir \
    torch==2.2.1+cpu torchvision==0.17.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt


# ==========================================
# ETAPA 2: DESARROLLO (corre como root, sin usuario restringido)
# ==========================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    gdal-bin \
    proj-bin \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Sin 'useradd' ni 'USER pawuser': el contenedor corre como root.
# El código se copia por si se hace build sin bind mount, pero en dev
# el volumen './:/app' del compose lo sobreescribe de todas formas.
COPY . .