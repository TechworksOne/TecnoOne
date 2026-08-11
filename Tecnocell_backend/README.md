# TecnoOne backend

## Configuracion

Copiar `.env.example` a `.env` y definir `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` y `JWT_SECRET`. No existen usuarios ni credenciales predeterminadas.

## Instalacion nueva

La base debe estar vacia. Produccion importa `database/tecnoone_baseline.sql` una sola vez mediante `docker-entrypoint-initdb.d`. Luego la primera empresa y sus usuarios se crean mediante el flujo soportado de la aplicacion.

No ejecutar migraciones historicas sobre una instalacion nueva. No aplicar la baseline sobre una instalacion existente.

## Generacion de baseline

Con una copia validada de la DB actual configurada en `.env`:

```text
npm run baseline:generate
```

El generador exporta toda la estructura y solamente `modulos`, `permisos`, `planes` y `plan_modulos`.
