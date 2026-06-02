# Guía de Instalación de Nginx en Servidor Hetzner

## 📦 1. Instalar Nginx

```bash
# Conectarse al servidor
ssh root@your-hetzner-ip

# Actualizar paquetes
apt update && apt upgrade -y

# Instalar Nginx
apt install nginx -y

# Verificar instalación
nginx -v
# nginx version: nginx/1.18.0 (Ubuntu)

# Verificar que está corriendo
systemctl status nginx
```

## 📂 2. Configurar Estructura de Carpetas

```bash
# Crear estructura de proyecto
mkdir -p /var/www/tecnocell
cd /var/www/tecnocell

# Clonar tu proyecto (o subir con SFTP/rsync)
# git clone https://github.com/tu-usuario/tecnocell.git .
# o usar SFTP para copiar archivos

# Crear carpeta de uploads
mkdir -p /var/www/tecnocell/Tecnocell_backend/uploads/reparaciones

# Dar permisos correctos
chown -R www-data:www-data /var/www/tecnocell/Tecnocell_backend/uploads
chmod -R 755 /var/www/tecnocell/Tecnocell_backend/uploads
```

## ⚙️ 3. Configurar Nginx

```bash
# Copiar archivo de configuración
cp /var/www/tecnocell/Tecnocell_backend/nginx/tecnocell.conf /etc/nginx/sites-available/tecnocell

# Editar configuración (cambiar dominio/IP)
nano /etc/nginx/sites-available/tecnocell

# Crear enlace simbólico para habilitar
ln -s /etc/nginx/sites-available/tecnocell /etc/nginx/sites-enabled/

# Remover configuración default (opcional)
rm /etc/nginx/sites-enabled/default

# Verificar sintaxis
nginx -t
# nginx: configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful

# Recargar Nginx
systemctl reload nginx
```

## 🚀 4. Configurar Node.js Backend

```bash
# Instalar Node.js (si no está instalado)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install nodejs -y

# Verificar
node -v  # v18.x.x
npm -v   # 9.x.x

# Instalar PM2 (gestor de procesos)
npm install -g pm2

# Ir al directorio del backend
cd /var/www/tecnocell/Tecnocell_backend

# Instalar dependencias
npm install

# Iniciar con PM2
pm2 start server.js --name tecnocell-api

# Configurar inicio automático
pm2 startup
pm2 save

# Ver logs
pm2 logs tecnocell-api
```

## 🔐 5. Configurar Firewall

```bash
# Permitir tráfico HTTP y HTTPS
ufw allow 'Nginx Full'
ufw allow 22  # SSH (importante!)
ufw enable

# Verificar
ufw status
```

## 🌐 6. Configurar DNS (en tu proveedor)

```
Tipo: A
Host: api.tecnocell.com
Valor: [IP de tu servidor Hetzner]
TTL: 3600
```

## 🔒 7. Configurar SSL con Let's Encrypt (HTTPS)

```bash
# Instalar Certbot
apt install certbot python3-certbot-nginx -y

# Obtener certificado SSL
certbot --nginx -d api.tecnocell.com

# Certbot configurará automáticamente Nginx para HTTPS

# Verificar renovación automática
certbot renew --dry-run

# Configurar cron para renovación (ya viene por defecto)
```

## 🧪 8. Probar la Instalación

```bash
# Test 1: Health check
curl http://localhost/health
# OK

# Test 2: API desde local
curl http://localhost:3000/
# {"message":"API Tecnocell funcionando correctamente"}

# Test 3: API a través de Nginx
curl http://localhost/api/
# {"message":"API Tecnocell funcionando correctamente"}

# Test 4: Subir imagen de prueba
mkdir -p /var/www/tecnocell/Tecnocell_backend/uploads/reparaciones/test
echo "test" > /var/www/tecnocell/Tecnocell_backend/uploads/reparaciones/test/test.txt
curl http://localhost/uploads/reparaciones/test/test.txt
# test
```

## 📊 9. Monitoreo

```bash
# Ver logs de Nginx
tail -f /var/log/nginx/tecnocell_access.log
tail -f /var/log/nginx/tecnocell_error.log
tail -f /var/log/nginx/uploads_access.log

# Ver logs de Node.js
pm2 logs tecnocell-api

# Ver estado de PM2
pm2 status

# Ver uso de recursos
pm2 monit
```

## 🔄 10. Comandos Útiles de Mantenimiento

```bash
# Reiniciar servicios
systemctl restart nginx
pm2 restart tecnocell-api

# Recargar configuración de Nginx sin downtime
nginx -t && systemctl reload nginx

# Actualizar aplicación
cd /var/www/tecnocell
git pull
cd Tecnocell_backend
npm install
pm2 restart tecnocell-api

# Limpiar uploads antiguos (opcional)
find /var/www/tecnocell/Tecnocell_backend/uploads/reparaciones -type f -mtime +365 -delete

# Backup de uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /var/www/tecnocell/Tecnocell_backend/uploads
```

## 🛡️ 11. Seguridad Adicional

```bash
# Limitar tamaño de subida en Nginx (ya está en config)
# client_max_body_size 10M;

# Prevenir acceso directo a carpetas
# autoindex off;

# Configurar fail2ban (opcional)
apt install fail2ban -y

# Crear jail para Nginx
nano /etc/fail2ban/jail.local
```

```ini
[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true
```

```bash
systemctl restart fail2ban
```

## 📱 12. Probar desde Frontend

Una vez configurado, tus URLs serán:

**Desarrollo Local (localhost:3000):**
```
http://localhost:3000/uploads/reparaciones/REP123/historial/img.jpg
```

**Producción Hetzner:**
```
http://api.tecnocell.com/uploads/reparaciones/REP123/historial/img.jpg
https://api.tecnocell.com/uploads/reparaciones/REP123/historial/img.jpg  (con SSL)
```

## ⚠️ Troubleshooting

### Problema: 403 Forbidden en /uploads
```bash
# Verificar permisos
ls -la /var/www/tecnocell/Tecnocell_backend/uploads
chown -R www-data:www-data /var/www/tecnocell/Tecnocell_backend/uploads
chmod -R 755 /var/www/tecnocell/Tecnocell_backend/uploads
```

### Problema: 502 Bad Gateway
```bash
# Verificar que Node.js está corriendo
pm2 status
pm2 restart tecnocell-api

# Verificar puerto
netstat -tlnp | grep 3000
```

### Problema: Imágenes no se cargan
```bash
# Verificar que archivo existe
ls -la /var/www/tecnocell/Tecnocell_backend/uploads/reparaciones/

# Verificar logs
tail -f /var/log/nginx/uploads_error.log
```

## 🎉 ¡Listo!

Tu servidor Hetzner ahora está configurado con:
- ✅ Nginx sirviendo imágenes estáticas
- ✅ Node.js API en puerto 3000
- ✅ PM2 gestionando procesos
- ✅ SSL/HTTPS con Let's Encrypt
- ✅ Firewall configurado
- ✅ Logs centralizados
- ✅ Inicio automático en reinicio
