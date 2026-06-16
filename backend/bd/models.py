from django.db import models

from django.contrib.gis.db import models
from django.contrib.auth.models import AbstractUser

# 1. Tabla Usuario 
# Extendemos el usuario de Django para aprovechar el login, contraseñas y tokens de DRF
class Usuario(AbstractUser):
    ROLES_VALIDOS = ['REPORTERO', 'RESCATISTA', 'PATROCINADOR']

    email = models.EmailField(unique=True)
    roles = models.JSONField(default=list, help_text="Lista de roles: REPORTERO, RESCATISTA, PATROCINADOR")
    telefono = models.CharField(max_length=20, blank=True)
    foto_perfil = models.ImageField(upload_to='usuarios/perfiles/', blank=True, null=True)

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
    usuario = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='perfil_patrocinador')


    ubicacion = models.CharField(max_length=255)
    capacidad = models.CharField(max_length=100)
    horario = models.CharField(max_length=100) 
    redes = models.CharField(max_length=255, blank=True) 
    correo = models.EmailField() # string validado para correos 
    
    nivel = models.CharField(max_length=50, default='SILVER') # ej. "PATROCINADOR GOLD"
    total_donado = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    casos_soportados = models.IntegerField(default=0)
    fecha_inicio_coordinacion = models.DateField(auto_now_add=True)

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
    estado = models.CharField(max_length=50, default='PENDIENTE')
    tipo_incidencia = models.CharField(max_length=50, default='EMERGENCIA')
    recompensa = models.FloatField(null=True, blank=True)

    # Campos calculados por el sistema
    urgency_score = models.FloatField(default=0)
    trust_score = models.FloatField(default=50)
    created_at = models.DateTimeField(auto_now_add=True)

    folio = models.CharField(max_length=20, unique=True, null=True, blank=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if not self.folio:
            year = self.created_at.year
            self.folio = f"PT-{year}-{self.pk:04d}"
            super().save(update_fields=['folio'])

    def __str__(self):
        return f"{self.folio or f'#{self.id}'} - {self.tipo_incidencia} ({self.estado})"
