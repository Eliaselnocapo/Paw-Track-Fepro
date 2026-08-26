# ==========================================
# ETAPA 1: BUILDER (Aquí se queda tu código de instalación)
# ==========================================
FROM python:3.11-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /build

# Instalamos los compiladores pesados (gcc, g++)
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

# Creamos el entorno virtual aislado
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# AQUÍ ESTÁ TU CÓDIGO: Instalamos PyTorch CPU y tus requirements
RUN pip install --default-timeout=1000 --no-cache-dir \
    torch==2.2.1+cpu torchvision==0.17.1+cpu \
    --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt


# ==========================================
# ETAPA 2: PRODUCCIÓN (Imagen Final Ligera y Segura)
# ==========================================
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# SOLO dependencias de runtime (sin -dev)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    gdal-bin \
    proj-bin \
    && rm -rf /var/lib/apt/lists/*

# AQUÍ ESTÁ LA MAGIA: Traemos el entorno virtual ya compilado de la Etapa 1
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Creamos el usuario seguro con UID 1000
RUN groupadd -g 1001 pawuser && \
    useradd -u 1001 -g pawuser -s /bin/bash -m pawuser

# AQUÍ ESTÁ TU COPY . /app/ (Ajustado para darle permisos al usuario)
COPY --chown=pawuser:pawuser . .

USER pawuser