```mermaid```
erDiagram
    Usuario ||--o{ Incidencia : "reporta"
    animal ||--o{ Incidencia : "involucra"
    Patrocinador |o--o{ Incidencia : "patrocina (si es encontrado)"

    Usuario {
        int ID PK "#*"
        string Nombre "*"
        string Apellidos "*"
        string Fecha_nacimiento "*" 
        string Telefono "*"
        string Correo "*"
    }
    animal {
        int ID PK "#*"
        string Color "O"
        string Tamano "O"
        string Tipo "O"
        string Raza "O"
        string Agresividad "O"
        string Salud "O"
        string Nombre "O"
        string edad "O"
        string peso "O"
        string otros "O"
    }
    Incidencia {
        int ID PK  "Llave Primaria (Autoincremental)"
        string Folio UK "Folio Dinámico (Único)"
        int us_ID FK
        string Imagen "*"
        string Ubicacion "*"
        int an_ID FK
        string Estado "*"
        string Tipo_Incidencia "*"
        string Fecha "*"
        float Recompensa "Perdido"
        string an_Nom "Perdido"
        int Pat_ID FK "Encontrado"
    }
    Patrocinador {
        int ID PK "*"
        string Nombre_entidad "*"
        string tipo_entidad "*"
        string Ubicacion "*"
        string Telefono "*"
        int Capacidad "O"
        string Horario "O"
        string Redes "O"
        string Correo "*"
    }