from django.apps import AppConfig


class BdConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'bd'

    def ready(self):
        # Importamos las señales cuando la app arranca
        import bd.signals