 cat monitor_docker.sh
#!/bin/bash

# 1. Definimos las rutas absolutas porque Cron no tiene PATH configurado
DOCKER_BIN="/usr/bin/docker"
MSMTP_BIN="/usr/bin/msmtp"

# 2. Obtenemos TODOS los contenedores y usamos grep para capturar 'exited' O 'unhealthy'
CAIDOS=$($DOCKER_BIN ps -a --format "{{.Names}} ({{.Status}})" | grep -iE "exited|unhealthy")

# 3. Si la variable contiene texto, disparamos la alerta
if [ -n "$CAIDOS" ]; then
    ASUNTO="Subject: [ALERTA CRITICA] PawTrack - Contenedores Caidos"
    CUERPO="El servidor Debian ha detectado fallos en la infraestructura de Paw Track.\n\nContenedores afectados:\n$CAIDOS\n\nPor favor, revisa los logs con 'docker compose logs'."

    echo -e "$ASUNTO\n\n$CUERPO" | $MSMTP_BIN alertasmantenimientopawtrack@gmail.com