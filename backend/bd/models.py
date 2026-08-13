from django.db import models

from django.contrib.gis.db import models
from django.contrib.auth.models import AbstractUser, BaseUserManager

class UsuarioManager(BaseUserManager):
    """
    Manager personalizado para que el email sea el identificador único
    para la autenticación, eliminando por completo el uso de username.
    """
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('El email es obligatorio para crear un usuario.')
        
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('El superusuario debe tener is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('El superusuario debe tener is_superuser=True.')

        return self.create_user(email, password, **extra_fields)

# 1. Tabla Usuario 
# Extendemos el usuario de Django para aprovechar el login, contraseñas y tokens de DRF
class Usuario(AbstractUser):
    ROLES_VALIDOS = ['REPORTERO', 'RESCATISTA', 'PATROCINADOR']

    username = None
    
    email = models.EmailField(unique=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    objects = UsuarioManager()
    
    roles = models.JSONField(default=list, help_text="Lista de roles: REPORTERO, RESCATISTA, PATROCINADOR")
    telefono = models.CharField(max_length=20, blank=True)
    ubicacion = models.CharField(max_length=255, blank=True, default='')
    foto_perfil = models.ImageField(upload_to='usuarios/perfiles/', blank=True, null=True)
    reputation_score = models.FloatField(default=100)
    fraud_flags = models.IntegerField(default=0)
    
    def tiene_rol(self, rol: str) -> bool:
        return rol in (self.roles or [])

    def __str__(self):
        roles_str = ', '.join(self.roles or []) or 'sin rol'
        return f"{self.first_name} {self.last_name} ({roles_str})"

# Las Tablas de Extensión de usuario

class PerfilRescatista(models.Model):
    
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='perfil_rescatista')
    
    misiones_completadas = models.IntegerField(default=0)
    horas_campo = models.IntegerField(default=0)
    
    habilidades = models.JSONField(default=list, blank=True) 
    esta_certificado = models.BooleanField(default=False) 

class PerfilPatrocinador(models.Model):
    """Entidad de apoyo (veterinaria, refugio, etc.) que puede coordinar
    recursos para casos (ver app `recursos`) y tener un perfil público en el
    directorio de "centros de apoyo" (ver app `centros`) — es el mismo
    registro para ambas cosas: quien dona/coordina recursos y quien aparece
    en el mapa de centros cercanos es la misma organización."""
    TIPO_CHOICES = [
        ('veterinaria', 'Veterinaria'),
        ('refugio',     'Refugio Animal'),
        ('otro',        'Otro'),
    ]
    ESTADO_CHOICES = [
        ('PENDIENTE', 'Pendiente'),
        ('APROBADO',  'Aprobado'),
        ('RECHAZADO', 'Rechazado'),
    ]
    NIVEL_CHOICES = [
        ('SILVER',   'Silver'),
        ('GOLD',     'Gold'),
        ('PLATINUM', 'Platinum'),
    ]

    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='perfil_patrocinador')

    # Datos de la entidad (base del prototipo BD)
    nombre    = models.CharField(max_length=255)
    direccion = models.CharField(max_length=255)
    # Coordenadas reales para búsquedas geoespaciales (mapa de centros
    # cercanos). `direccion` sigue siendo el texto libre que se muestra al
    # usuario; esto es lo que se usa para consultas PostGIS de distancia.
    ubicacion_geo = models.PointField(srid=4326, null=True, blank=True)
    telefono  = models.CharField(max_length=20, default='')
    horario   = models.CharField(max_length=100)
    correo    = models.EmailField(help_text='Correo oficial de la entidad')
    sitio_web = models.CharField(max_length=255, blank=True)
    descripcion = models.TextField(blank=True)

    formas_ayuda   = models.JSONField(default=list, blank=True, help_text='Ej. ["dinero", "comida", "voluntariado"]')
    redes_sociales = models.JSONField(default=dict, blank=True, help_text='Ej. {"facebook": "url", "whatsapp": "numero"}')

    # Perfil público (Fase 2 del directorio de centros)
    banner = models.ImageField(upload_to='centros/banners/', blank=True, null=True)
    logo   = models.ImageField(upload_to='centros/logos/', blank=True, null=True)
    mision = models.TextField(blank=True)
    vision = models.TextField(blank=True)

    # Campos adicionales para verificación y clasificación
    tipo           = models.CharField(max_length=50, choices=TIPO_CHOICES, default='otro')
    rfc_o_registro = models.CharField(max_length=100, blank=True, help_text='RFC o número de registro legal de la entidad')

    # Métricas de participación (calculadas por el sistema)
    nivel                    = models.CharField(max_length=50, choices=NIVEL_CHOICES, default='SILVER')
    total_donado             = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    casos_soportados         = models.IntegerField(default=0)
    fecha_inicio_coordinacion = models.DateField(auto_now_add=True)

    estado          = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='PENDIENTE')  # Bloquea self-service
    motivo_rechazo  = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Restricción a nivel BD para datos parcialmente válidos
    class Meta:
        constraints = [
            models.CheckConstraint(
                check=models.Q(nombre__isnull=False) & ~models.Q(nombre=''),
                name='datos_entidad_requeridos'
            )
        ]


    def __str__(self):
        return f"{self.nombre} ({self.tipo})"

# 2. Tabla Animal 
class Animal(models.Model):
    nombre = models.CharField(max_length=100)
    color = models.CharField(max_length=50)
    tamano = models.CharField(max_length=50)
    tipo = models.CharField(max_length=50)
    raza = models.CharField(max_length=50)
    agresividad = models.CharField(max_length=50)
    salud = models.CharField(max_length=100)
    otros = models.TextField(blank=True)
    edad_estimada = models.CharField(max_length=50, blank=True, default='')
    peso_estimado = models.CharField(max_length=50, blank=True, default='')

    def __str__(self):
        return self.nombre




# 4. Tabla Incidencia 
class Incidencia(models.Model):
    # Llaves Foráneas (Relaciones)
    usuario_reporta = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidencias_reportadas')
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='incidencias')

    patrocinador = models.ForeignKey(PerfilPatrocinador, on_delete=models.SET_NULL, null=True, blank=True, related_name='casos_apoyados')
    rescatista_asignado = models.ForeignKey(PerfilRescatista, on_delete=models.SET_NULL, null=True, blank=True, related_name='misiones_activas')

    # Datos del reporte
    imagen = models.ImageField(upload_to='incidencias/', blank=True, null=True)
    ubicacion = models.PointField(srid=4326)
    caracteristicas = models.TextField(blank=True, default='')
    ficha_voluntario = models.TextField(blank=True, default='')
    nombre_caso = models.CharField(max_length=150, blank=True, default='')
    nombre_contacto = models.CharField(max_length=150, blank=True, default='')
    telefono_contacto = models.CharField(max_length=20, blank=True, default='')
    estado = models.CharField(max_length=50, default='PENDIENTE')
    TIPO_INCIDENCIA_CHOICES = [
        ('EMERGENCIA', 'Emergencia'),
        ('EXTRAVIADO',  'Extraviado'),
        ('CALLEJERO',   'Callejero'),
    ]
    tipo_incidencia = models.CharField(max_length=50, choices=TIPO_INCIDENCIA_CHOICES, default='EMERGENCIA')
    recompensa = models.FloatField(null=True, blank=True)

    # Campos calculados por el sistema
    urgency_score = models.FloatField(default=0)
    trust_score = models.FloatField(default=50)
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    direccion   = models.CharField(max_length=255, blank=True, default='')
    # models.py
    coincidencias_visuales_ids = models.JSONField(default=list, blank=True, null=True)

    folio = models.CharField(max_length=20, unique=True, null=True, blank=True)

    FOLIO_TIPO_MAP = {
        'EMERGENCIA': 'EMG',
        'EXTRAVIADO':  'EXT',
        'CALLEJERO':   'CAL',
    }

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.folio:
            tipo_usuario = 'ANO' if self.usuario_reporta_id is None else 'REG'
            tipo_reporte = self.FOLIO_TIPO_MAP.get(self.tipo_incidencia, 'OTR')
            self.folio = f"{tipo_usuario}-{tipo_reporte}-{self.pk:05d}"
            super().save(update_fields=['folio'])

    def __str__(self):
        return f"{self.folio or f'#{self.id}'} - {self.tipo_incidencia} ({self.estado})"
