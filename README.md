# Ferretería Frontend Demo

Sistema de inventario de ferretería con roles Admin y Empleado. Frontend-only con datos mock y navegación completa.

## Stack Tecnológico

- **React 18** + **TypeScript**
- **Vite** (bundler y dev server)
- **TailwindCSS** (estilos)
- **React Router DOM** (navegación)
- **Zustand** (state management)
- **Lucide React** (iconos)

## Características

### Roles y Permisos (Simulados)

- **Admin**: Acceso completo a todas las funcionalidades
- **Empleado**: Acceso limitado (sin gestión de usuarios, compras, descuentos globales)

### Páginas Implementadas

- `/login` - Formulario de inicio con selector de rol
- `/dashboard` - KPIs y resúmenes
- `/productos` - CRUD de productos con modales
- `/compras` - Entradas de stock (solo Admin)
- `/cotizaciones` - Gestión de presupuestos
- `/pos` - Punto de venta
- `/fel` - Facturación electrónica
- `/reportes` - Informes y análisis
- `/usuarios` - Gestión de empleados (solo Admin)
- `/perfil` - Configuración de cuenta

### Componentes UI

- Sidebar colapsable con navegación
- Topbar con buscador y selector de rol
- Componentes reutilizables: Button, Input, Select, Modal, Table, Badge, Card, Toast
- Estados de carga (Skeleton) y vacíos (EmptyState)
- Confirmaciones (ConfirmDialog)

### Datos Mock

- 25 productos de ferretería con SKU, códigos de barras, stock, precios
- Categorías: Herramienta, Eléctrico, Plomería, Pintura, Construcción, etc.
- Ventas, cotizaciones, facturas FEL y movimientos de kardex simulados
- Usuarios con diferentes roles

## Instalación y Ejecución

### Prerrequisitos

- Node.js 16+
- npm o yarn

### Comandos

```bash
# Instalar dependencias
npm install

# Ejecutar en desarrollo
npm run dev

# Compilar para producción
npm run build

# Previsualizar build de producción
npm run preview
```

## Uso

1. **Iniciar sesión**: Selecciona un rol (Admin/Empleado) en `/login`
2. **Navegar**: Usa el sidebar para acceder a las diferentes secciones
3. **Cambiar rol**: Usa el selector en el topbar para simular diferentes permisos
4. **Interactuar**: Los formularios y acciones muestran toasts de confirmación

## Estructura del Proyecto

```
src/
├── assets/           # Logo y recursos
├── components/
│   ├── common/       # Layout (Topbar, Sidebar, PageHeader)
│   └── ui/          # Componentes reutilizables
├── lib/             # Utilidades (mock data, formatters)
├── pages/           # Páginas de la aplicación
├── store/           # Estado global (Zustand)
├── types/           # Definiciones TypeScript
├── App.tsx          # Componente principal
├── main.tsx         # Punto de entrada
└── routes.tsx       # Configuración de rutas
```

## Notas de Desarrollo

- **Sin backend**: Toda la funcionalidad es frontend-only con datos mock
- **Sin persistencia**: Los datos se reinician al recargar la página
- **Responsive**: Optimizado para escritorio y móvil
- **TypeScript**: Tipado completo (aunque con errores menores por dependencias)
- **Tailwind**: Paleta de colores corporativa, componentes reutilizables

## Deploy

Para deploy en Vercel, Netlify o similar:

```bash
npm run build
# Subir carpeta dist/
```

La aplicación es una SPA (Single Page Application) que requiere configuración de redirects para manejar las rutas del cliente.

## Funcionalidades Simuladas

- ✅ Cambio de roles en tiempo real
- ✅ Búsqueda y filtrado de productos
- ✅ Modales de creación/edición
- ✅ Ajustes de stock con kardex
- ✅ Carrito de compras (POS)
- ✅ Dashboard con KPIs
- ✅ Toasts de confirmación
- ✅ Navegación completa entre páginas
- ✅ Diseño responsive con Tailwind

## Próximas Mejoras

- Implementar funcionalidades completas de POS con escáner simulado
- Expandir sistema de cotizaciones con conversión a ventas
- Agregar más reportes con gráficos
- Mejorar validaciones de formularios
- Implementar paginación en tablas grandes
