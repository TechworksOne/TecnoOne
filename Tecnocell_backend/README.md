# Tecnocell Backend API

Backend para el sistema de gestión Tecnocell desarrollado con Node.js, Express y MySQL.

## 📋 Requisitos Previos

- Node.js (v14 o superior)
- XAMPP (con MySQL)
- npm o yarn

## 🚀 Instalación

1. **Instalar dependencias**
```bash
npm install
```

2. **Configurar XAMPP**
   - Abre XAMPP Control Panel
   - Inicia Apache y MySQL
   - Abre phpMyAdmin: http://localhost/phpmyadmin

3. **Crear la base de datos**
   - En phpMyAdmin, ve a la pestaña "SQL"
   - Copia y pega el contenido de `database/schema.sql`
   - Ejecuta el script

4. **Configurar variables de entorno**
   - El archivo `.env` ya está creado
   - Verifica que los datos de conexión sean correctos
   - Por defecto, XAMPP usa:
     - Usuario: `root`
     - Contraseña: (vacía)
     - Puerto: `3306`

## ▶️ Ejecutar el servidor

**Modo desarrollo (con auto-reload):**
```bash
npm run dev
```

**Modo producción:**
```bash
npm start
```

El servidor se ejecutará en: http://localhost:3000

## 📚 Endpoints API

### Autenticación

- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/verify` - Verificar token

### Usuarios (requiere autenticación)

- `GET /api/users` - Obtener todos los usuarios (solo admin)
- `GET /api/users/:id` - Obtener usuario por ID
- `POST /api/users` - Crear usuario (solo admin)
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario (solo admin)

### Clientes (requiere autenticación)

- `GET /api/customers` - Obtener todos los clientes
- `GET /api/customers/search?query=texto` - Buscar clientes
- `GET /api/customers/:id` - Obtener cliente por ID
- `POST /api/customers` - Crear cliente
- `PUT /api/customers/:id` - Actualizar cliente
- `DELETE /api/customers/:id` - Eliminar cliente

## 🔐 Autenticación

La API usa JWT (JSON Web Tokens). Para acceder a rutas protegidas:

1. Haz login en `/api/auth/login`
2. Guarda el token recibido
3. Incluye el token en el header de tus peticiones:
```
Authorization: Bearer TU_TOKEN_AQUI
```

## 👤 Usuario por Defecto

- **Email:** admin@tecnocell.com
- **Contraseña:** admin123
- **Rol:** admin

**⚠️ IMPORTANTE: Cambia esta contraseña después de la primera instalación**

## 📁 Estructura del Proyecto

```
Tecnocell_backend/
├── config/          # Configuración de base de datos
├── controllers/     # Lógica de negocio
├── routes/          # Definición de rutas
├── middleware/      # Middlewares (autenticación, etc.)
├── database/        # Scripts SQL
├── .env            # Variables de entorno
├── server.js       # Punto de entrada
└── package.json    # Dependencias
```

## 🔧 Próximos Pasos

1. Probar el login desde el frontend
2. Agregar más endpoints según necesites (productos, ventas, etc.)
3. Implementar validaciones adicionales
4. Agregar logs y monitoreo

## 🐛 Solución de Problemas

**Error de conexión a MySQL:**
- Verifica que MySQL esté corriendo en XAMPP
- Verifica las credenciales en `.env`
- Asegúrate de haber creado la base de datos con el script SQL

**Error "Cannot find module":**
```bash
npm install
```

**Puerto 3000 ocupado:**
- Cambia el puerto en `.env`
