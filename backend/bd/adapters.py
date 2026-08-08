from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from bd.models import PerfilRescatista


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    """
    Este adapter replica el mismo default que ya usa el registro normal
    (REPORTERO + RESCATISTA), para que ambos caminos de alta dejen al
    usuario en el mismo estado inicial. Solo aplica al CREAR el usuario 
    usando GOOGLE (save_user no se vuelve a llamar en logins posteriores 
    de una cuenta ya existente).
    """
    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form)
        if not user.roles:
            user.roles = ['REPORTERO', 'RESCATISTA']
            user.save(update_fields=['roles'])
            PerfilRescatista.objects.get_or_create(usuario=user)
        return user