from django.db import models

from django.contrib.gis.db import models
from django.contrib.auth.models import AbstractUser

# 1. Tabla Usuario 
# Extendemos el usuario de Django para aprovechar el login, contraseñas y tokens de DRF
class Usuario(AbstractUser):
    ROLES = [
        ('REPORTERO', 'Reportero'),
        ('RESCATISTA', 'Rescatista'),
        ('PATROCINADOR', 'Patrocinador'),
    ]
    rol_principal = models.CharField(max_length=20, choices=ROLES, default='REPORTERO')
    telefono = models.CharField(max_length=20, blank=True)
    foto_perfil = models.ImageField(upload_to='usuarios/perfiles/', blank=True, null=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.rol_principal})"

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
    otros = models.TextField(blank=True) # string extendido para notas adicionales 

    def __str__(self):
        return self.nombre




# 4. Tabla Incidencia 
class Incidencia(models.Model):
    # Llaves Foráneas (Relaciones)
    usuario_reporta = models.ForeignKey(Usuario, on_delete=models.SET_NULL, null=True, blank=True, related_name='incidencias_reportadas')
    animal = models.ForeignKey(Animal, on_delete=models.CASCADE, related_name='incidencias') # Relación 'involucra' 

    patrocinador = models.ForeignKey(PerfilPatrocinador, on_delete=models.SET_NULL, null=True, blank=True, related_name='casos_apoyados' )
    rescatista_asignado = models.ForeignKey(PerfilRescatista, on_delete=models.SET_NULL, null=True, blank=True, related_name='misiones_activas')

     # Datos del reporte 
    imagen = models.ImageField(upload_to='incidencias/', blank=True, null=True) # string que guarda la ruta de la imagen 
    ubicacion = models.PointField(srid=4326) # Implementación espacial estricta para coordenadas 
    caracteristicas = models.TextField() 
    estado = models.CharField(max_length=50)
    tipo_incidencia = models.CharField(max_length=50) 
        
    
    recompensa = models.FloatField(null=True, blank=True) 

    def __str__(self):
        return f"Folio {self.id} - {self.tipo_incidencia} ({self.estado})"
