import os
import requests
from dotenv import load_dotenv

# Carga las variables desde el archivo .env
load_dotenv()

def test_login_backend():
    url = "http://localhost:8000/dj-rest-auth/login/"
    
    # Leemos las credenciales de forma segura
    test_user = os.getenv("TEST_USER")
    test_password = os.getenv("TEST_PASSWORD")
    
    if not test_user or not test_password:
        print("🚨 Error: Faltan TEST_USER o TEST_PASSWORD en el archivo .env")
        return


# ingresare username y pasword que se van a usar para las pruebas 
    payload = {
        "username": test_user,
        "password": test_password 
    }
    
    print(f"Iniciando prueba de Login contra: {url}")
    print("-" * 40)

    try:
        response = requests.post(url, json=payload)
        
        if response.status_code == 200:
            print("RESULTADO: ¡Éxito! El inicio de sesión funciona perfectamente.")
            print(f"Token devuelto: {response.json().get('key')}")
        else:
            print(f"RESULTADO: Falló el inicio de sesión. (Código HTTP {response.status_code})")
            print(f"📝 Detalles del error: {response.json()}")
            
    except requests.exceptions.ConnectionError:
        print("ERROR FATAL: No se pudo conectar al servidor.")

if __name__ == "__main__":
    test_login_backend()
