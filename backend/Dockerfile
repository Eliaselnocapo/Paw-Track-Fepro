# imagen oficial de Python ligera
FROM python:3.11-slim

# Configurar variables de entorno para que Python no escriba archivos .pyc ni buffer de salida
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

#  Instalar dependencias del sistema necesarias para compilar ciertas librerías de Postgres
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    gdal-bin \
    libgdal-dev \
    binutils \
    libproj-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

COPY . /app/
