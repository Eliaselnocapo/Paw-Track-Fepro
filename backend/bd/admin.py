from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.gis.admin import GISModelAdmin

from .models import Usuario, PerfilRescatista, PerfilPatrocinador, Animal, Incidencia

# -------------------------------------------------------------------
# 1. INLINES (Para mostrar los perfiles dentro de la vista de Usuario)
# -------------------------------------------------------------------
class PerfilRescatistaInline(admin.StackedInline):
    model = PerfilRescatista
    can_delete = False
    verbose_name_plural = 'Perfil de Rescatista'
    # Solo mostrarlo si el usuario lo necesita, pero por defecto lo anclamos

class PerfilPatrocinadorInline(admin.StackedInline):
    model = PerfilPatrocinador
    can_delete = False
    verbose_name_plural = 'Perfil de Patrocinador'

# -------------------------------------------------------------------
# 2. EL USUARIO (Configuración avanzada)
# -------------------------------------------------------------------
class CustomUserAdmin(UserAdmin):
    inlines = (PerfilRescatistaInline, PerfilPatrocinadorInline)
    
     
    fieldsets = UserAdmin.fieldsets + (
        ('Información Extra', {
            'fields': ('rol_principal', 'telefono', 'foto_perfil')
        }),
    )
    
    # Lo que se ve en la tabla de resumen
    list_display = ('username', 'email', 'first_name', 'rol_principal', 'is_staff')
    list_filter = ('rol_principal', 'is_staff', 'is_superuser')

# Registramos el Usuario 
admin.site.register(Usuario, CustomUserAdmin)

# -------------------------------------------------------------------
# 3. TABLAS SIMPLES
# -------------------------------------------------------------------
@admin.register(Animal)
class AnimalAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'tipo', 'raza', 'salud')
    list_filter = ('tipo', 'salud')
    search_fields = ('nombre', 'raza')

# -------------------------------------------------------------------
# 4. TABLA ESPACIAL (GeoDjango)
# -------------------------------------------------------------------
@admin.register(Incidencia)
class IncidenciaAdmin(GISModelAdmin):
    # GISModelAdmin 
    list_display = ('id', 'tipo_incidencia', 'estado', 'usuario_reporta', 'animal')
    list_filter = ('estado', 'tipo_incidencia')
    search_fields = ('caracteristicas',)
    # Usar OpenStreetMap 
    gis_widget_kwargs = {'attrs': {'default_zoom': 12, 'default_lon': -98.2, 'default_lat': 19.0}}
