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

    #  Sobrescribir ordering para que no busque 'username'
    ordering = ('email',)

    #  Reescribir list_display sin 'username'
    list_display = ('email', 'first_name', 'get_roles', 'is_staff')
    list_filter = ('is_staff', 'is_superuser')

    #  Definir fieldsets desde cero (sin heredar del default que trae username)
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Información Extra', {'fields': ('first_name', 'last_name', 'telefono', 'foto_perfil', 'roles')}),
        ('Reputación', {'fields': ('fraud_flags',)}),
        ('Permisos', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        ('Fechas', {'fields': ('last_login', 'date_joined')}),
    )

    #  Definir la pantalla de creación (add_user) sin username
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password', 'roles'),
        }),
    )

    @admin.display(description='Roles')
    def get_roles(self, obj):
        return ', '.join(obj.roles or [])

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

# -------------------------------------------------------------------
# 5. CENTRO DE APOYO (PerfilPatrocinador) — registro standalone para
#    poder aprobar/rechazar solicitudes de centro sin entrar al Usuario.
# -------------------------------------------------------------------
@admin.register(PerfilPatrocinador)
class PerfilPatrocinadorAdmin(GISModelAdmin):
    list_display = ('nombre', 'tipo', 'estado', 'usuario', 'created_at')
    list_filter = ('estado', 'tipo')
    search_fields = ('nombre', 'direccion', 'usuario__email')
    gis_widget_kwargs = {'attrs': {'default_zoom': 12, 'default_lon': -98.2, 'default_lat': 19.0}}