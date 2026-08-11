/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.25-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tecnoone_demo
-- ------------------------------------------------------
-- Server version	10.6.25-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `agenda_eventos`
--

DROP TABLE IF EXISTS `agenda_eventos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `agenda_eventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `fecha` date NOT NULL,
  `hora` time DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `tipo` enum('nota','cita','recordatorio','otro') NOT NULL DEFAULT 'nota',
  `color` varchar(20) DEFAULT NULL,
  `creado_por` varchar(100) DEFAULT NULL,
  `creado_por_id` int(11) DEFAULT NULL,
  `para_rol` varchar(50) DEFAULT NULL,
  `para_usuario_id` int(11) DEFAULT NULL,
  `para_usuario_nombre` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_agenda_eventos_empresa_id` (`empresa_id`),
  KEY `idx_agenda_eventos_empresa_fecha` (`empresa_id`,`fecha`),
  KEY `idx_agenda_eventos_empresa_usuario` (`empresa_id`,`para_usuario_id`),
  CONSTRAINT `fk_agenda_eventos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `auditoria_logs`
--

DROP TABLE IF EXISTS `auditoria_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditoria_logs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` bigint(20) NOT NULL,
  `sucursal_id` bigint(20) unsigned DEFAULT NULL,
  `usuario_id` bigint(20) DEFAULT NULL,
  `usuario_nombre` varchar(255) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `entidad` varchar(80) NOT NULL,
  `entidad_id` varchar(100) DEFAULT NULL,
  `descripcion` varchar(500) NOT NULL,
  `datos_anteriores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_anteriores`)),
  `datos_nuevos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_nuevos`)),
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `metodo_http` varchar(10) DEFAULT NULL,
  `ruta` varchar(500) DEFAULT NULL,
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_auditoria_empresa` (`empresa_id`),
  KEY `idx_auditoria_usuario` (`usuario_id`),
  KEY `idx_auditoria_accion` (`accion`),
  KEY `idx_auditoria_entidad` (`entidad`),
  KEY `idx_auditoria_created_at` (`created_at`),
  KEY `idx_auditoria_empresa_created_at` (`empresa_id`,`created_at`),
  KEY `idx_auditoria_empresa_sucursal_fecha` (`empresa_id`,`sucursal_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=50 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_auditoria_logs_append_only_update
BEFORE UPDATE ON auditoria_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'auditoria_logs es append-only: UPDATE no permitido';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_auditoria_logs_append_only_delete
BEFORE DELETE ON auditoria_logs
FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'auditoria_logs es append-only: DELETE no permitido';
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `auditoria_super_admin`
--

DROP TABLE IF EXISTS `auditoria_super_admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `auditoria_super_admin` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `super_admin_id` int(11) NOT NULL,
  `accion` varchar(80) NOT NULL,
  `entidad` varchar(80) NOT NULL,
  `entidad_id` varchar(100) DEFAULT NULL,
  `datos_anteriores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_anteriores`)),
  `datos_nuevos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_nuevos`)),
  `ip` varchar(64) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `fecha_creacion` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_auditoria_sa_usuario` (`super_admin_id`),
  KEY `idx_auditoria_sa_entidad` (`entidad`,`entidad_id`),
  KEY `idx_auditoria_sa_fecha` (`fecha_creacion`),
  CONSTRAINT `fk_auditoria_sa_usuario` FOREIGN KEY (`super_admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=30 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `caja_chica`
--

DROP TABLE IF EXISTS `caja_chica`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `caja_chica` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL DEFAULT 1,
  `sucursal_id` bigint(20) unsigned DEFAULT NULL,
  `tipo_movimiento` enum('INGRESO','EGRESO') NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `concepto` varchar(255) NOT NULL,
  `categoria` varchar(100) DEFAULT 'Otro',
  `estado` enum('PENDIENTE','CONFIRMADO','ANULADO') NOT NULL DEFAULT 'PENDIENTE',
  `venta_id` int(11) DEFAULT NULL,
  `realizado_por` varchar(100) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_movimiento` datetime DEFAULT current_timestamp(),
  `referencia_tipo` varchar(50) DEFAULT NULL,
  `referencia_id` varchar(50) DEFAULT NULL,
  `confirmado_por` int(11) DEFAULT NULL,
  `confirmado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_caja_chica_confirmado_por` (`confirmado_por`),
  KEY `idx_caja_chica_empresa_id` (`empresa_id`),
  KEY `idx_caja_chica_empresa_sucursal` (`empresa_id`,`sucursal_id`),
  KEY `idx_caja_chica_scope_estado` (`empresa_id`,`sucursal_id`,`estado`,`fecha_movimiento`),
  CONSTRAINT `fk_caja_chica_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=67 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `caja_chica_arqueos`
--

DROP TABLE IF EXISTS `caja_chica_arqueos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `caja_chica_arqueos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `saldo_teorico` decimal(10,2) NOT NULL,
  `monto_contado` decimal(10,2) NOT NULL,
  `diferencia` decimal(10,2) NOT NULL,
  `resultado` enum('CUADRADO','SOBRANTE','FALTANTE') NOT NULL,
  `ultimo_movimiento_id` int(11) DEFAULT NULL,
  `usuario_id` int(11) NOT NULL,
  `usuario_nombre` varchar(255) NOT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_arqueo` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_caja_chica_arqueos_scope_fecha` (`empresa_id`,`sucursal_id`,`fecha_arqueo`,`id`),
  KEY `idx_caja_chica_arqueos_empresa_usuario_fecha` (`empresa_id`,`usuario_id`,`fecha_arqueo`),
  KEY `idx_caja_chica_arqueos_usuario_empresa` (`usuario_id`,`empresa_id`),
  CONSTRAINT `fk_caja_chica_arqueos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_caja_chica_arqueos_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `fk_caja_chica_arqueos_usuario_empresa` FOREIGN KEY (`usuario_id`, `empresa_id`) REFERENCES `users` (`id`, `empresa_id`),
  CONSTRAINT `chk_caja_chica_arqueos_monto` CHECK (`monto_contado` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `caja_sesiones`
--

DROP TABLE IF EXISTS `caja_sesiones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `caja_sesiones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `caja_id` bigint(20) unsigned NOT NULL,
  `usuario_apertura_id` int(11) NOT NULL,
  `fondo_inicial_centavos` int(11) NOT NULL DEFAULT 0,
  `fondo_sugerido_centavos` int(11) DEFAULT NULL,
  `diferencia_apertura_centavos` int(11) DEFAULT NULL,
  `estado` enum('ABIERTA','CERRADA') NOT NULL DEFAULT 'ABIERTA',
  `fecha_apertura` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_cierre` timestamp NULL DEFAULT NULL,
  `efectivo_esperado_centavos` int(11) DEFAULT NULL,
  `efectivo_contado_centavos` int(11) DEFAULT NULL,
  `diferencia_centavos` int(11) DEFAULT NULL,
  `fondo_siguiente_centavos` int(11) DEFAULT NULL,
  `retiro_cierre_centavos` int(11) DEFAULT NULL,
  `cerrado_por` int(11) DEFAULT NULL,
  `notas_cierre` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `sesion_abierta_caja` bigint(20) unsigned GENERATED ALWAYS AS (if(`estado` = 'ABIERTA',`caja_id`,NULL)) STORED,
  `sesion_abierta_usuario` int(11) GENERATED ALWAYS AS (if(`estado` = 'ABIERTA',`usuario_apertura_id`,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_caja_sesiones_movimiento_scope` (`empresa_id`,`sucursal_id`,`caja_id`,`id`),
  UNIQUE KEY `uk_sesion_caja_abierta` (`empresa_id`,`sucursal_id`,`sesion_abierta_caja`),
  UNIQUE KEY `uk_sesion_usuario_abierta` (`empresa_id`,`sesion_abierta_usuario`),
  KEY `idx_sesiones_scope` (`empresa_id`,`sucursal_id`,`estado`),
  KEY `idx_sesiones_caja_estado` (`empresa_id`,`sucursal_id`,`caja_id`,`estado`),
  KEY `fk_sesion_usuario_apertura` (`usuario_apertura_id`),
  KEY `fk_sesion_cerrado_por` (`cerrado_por`),
  CONSTRAINT `fk_sesion_caja` FOREIGN KEY (`empresa_id`, `sucursal_id`, `caja_id`) REFERENCES `cajas` (`empresa_id`, `sucursal_id`, `id`),
  CONSTRAINT `fk_sesion_cerrado_por` FOREIGN KEY (`cerrado_por`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_sesion_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `fk_sesion_usuario_apertura` FOREIGN KEY (`usuario_apertura_id`) REFERENCES `users` (`id`),
  CONSTRAINT `chk_sesion_fondo` CHECK (`fondo_inicial_centavos` >= 0),
  CONSTRAINT `chk_sesion_cierre` CHECK (`estado` = 'CERRADA' and `fecha_cierre` is not null or `estado` = 'ABIERTA')
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cajas`
--

DROP TABLE IF EXISTS `cajas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cajas` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_cajas_sucursal_codigo` (`sucursal_id`,`codigo`),
  UNIQUE KEY `uk_cajas_empresa_sucursal_id` (`empresa_id`,`sucursal_id`,`id`),
  KEY `idx_cajas_empresa_sucursal_estado` (`empresa_id`,`sucursal_id`,`activa`),
  CONSTRAINT `fk_cajas_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_cajas_sucursal_empresa` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `chk_cajas_activa` CHECK (`activa` in (0,1))
) ENGINE=InnoDB AUTO_INCREMENT=25 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `icono` varchar(50) DEFAULT NULL,
  `orden` int(11) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_categorias_empresa_nombre` (`empresa_id`,`nombre`),
  KEY `idx_categorias_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `check_equipo`
--

DROP TABLE IF EXISTS `check_equipo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `check_equipo` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reparacion_id` varchar(50) NOT NULL,
  `tipo_equipo` varchar(50) NOT NULL,
  `enciende` tinyint(1) DEFAULT 0,
  `tactil_funciona` tinyint(1) DEFAULT 0,
  `pantalla_ok` tinyint(1) DEFAULT 0,
  `bateria_ok` tinyint(1) DEFAULT 0,
  `carga_ok` tinyint(1) DEFAULT 0,
  `telefono_checks` text DEFAULT NULL,
  `tablet_checks` text DEFAULT NULL,
  `computadora_checks` text DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `fotos_checklist` text DEFAULT NULL,
  `realizado_por` varchar(100) DEFAULT 'Sistema',
  `fecha_checklist` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reparacion_id` (`reparacion_id`),
  KEY `idx_fecha_checklist` (`fecha_checklist`),
  CONSTRAINT `check_equipo_ibfk_1` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `clientes`
--

DROP TABLE IF EXISTS `clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) DEFAULT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `nit` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `metodo_pago_preferido` enum('efectivo','tarjeta','transferencia') DEFAULT 'efectivo',
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `activo` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_telefono` (`telefono`),
  KEY `idx_nit` (`nit`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_clientes_empresa_id` (`empresa_id`),
  CONSTRAINT `fk_clientes_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compra_inventario_aplicaciones`
--

DROP TABLE IF EXISTS `compra_inventario_aplicaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_inventario_aplicaciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `compra_id` int(11) NOT NULL,
  `compra_item_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `accion` enum('RECEPCION','ANULACION') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_compra_inventario_aplicacion` (`empresa_id`,`sucursal_id`,`compra_item_id`,`accion`),
  KEY `idx_compra_inventario_compra` (`empresa_id`,`sucursal_id`,`compra_id`),
  KEY `fk_compra_inventario_compra` (`compra_id`),
  KEY `fk_compra_inventario_item` (`compra_item_id`),
  KEY `fk_compra_inventario_producto` (`empresa_id`,`producto_id`),
  CONSTRAINT `fk_compra_inventario_compra` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`),
  CONSTRAINT `fk_compra_inventario_item` FOREIGN KEY (`compra_item_id`) REFERENCES `compra_items` (`id`),
  CONSTRAINT `fk_compra_inventario_producto` FOREIGN KEY (`empresa_id`, `producto_id`) REFERENCES `productos` (`empresa_id`, `id`),
  CONSTRAINT `fk_compra_inventario_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compra_items`
--

DROP TABLE IF EXISTS `compra_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `compra_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `nombre_producto` varchar(200) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `aplica_serie` tinyint(1) DEFAULT 0,
  `tipo_item` enum('producto','repuesto') DEFAULT 'producto',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_compra` (`compra_id`),
  KEY `idx_producto` (`producto_id`),
  KEY `idx_compra_items_empresa_id` (`empresa_id`),
  KEY `idx_compra_items_empresa_compra` (`empresa_id`,`compra_id`),
  KEY `idx_compra_items_empresa_producto` (`empresa_id`,`producto_id`),
  CONSTRAINT `compra_items_ibfk_1` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_compra_items_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compra_movimientos_financieros`
--

DROP TABLE IF EXISTS `compra_movimientos_financieros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `compra_movimientos_financieros` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `compra_id` int(11) NOT NULL,
  `accion` enum('EGRESO','REVERSA') NOT NULL,
  `metodo` varchar(30) NOT NULL,
  `monto_centavos` bigint(20) NOT NULL,
  `caja_id` bigint(20) unsigned NOT NULL,
  `caja_sesion_id` bigint(20) unsigned NOT NULL,
  `referencia` varchar(150) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_compra_movimiento_financiero` (`empresa_id`,`sucursal_id`,`compra_id`,`accion`),
  KEY `idx_compra_fin_scope` (`empresa_id`,`sucursal_id`,`compra_id`,`accion`),
  KEY `idx_compra_fin_caja_sesion` (`empresa_id`,`sucursal_id`,`caja_id`,`caja_sesion_id`),
  KEY `fk_compra_fin_usuario` (`usuario_id`),
  CONSTRAINT `fk_compra_fin_caja_sesion` FOREIGN KEY (`empresa_id`, `sucursal_id`, `caja_id`, `caja_sesion_id`) REFERENCES `caja_sesiones` (`empresa_id`, `sucursal_id`, `caja_id`, `id`),
  CONSTRAINT `fk_compra_fin_compra_scope` FOREIGN KEY (`empresa_id`, `sucursal_id`, `compra_id`) REFERENCES `compras` (`empresa_id`, `sucursal_id`, `id`),
  CONSTRAINT `fk_compra_fin_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `fk_compra_fin_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_compra_fin_monto` CHECK (`monto_centavos` > 0),
  CONSTRAINT `chk_compra_fin_metodo` CHECK (`metodo` = 'EFECTIVO')
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `compras`
--

DROP TABLE IF EXISTS `compras`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `compras` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `numero_compra` varchar(50) NOT NULL,
  `fecha_compra` date NOT NULL,
  `proveedor_id` int(11) DEFAULT NULL,
  `proveedor_nombre` varchar(200) NOT NULL,
  `proveedor_telefono` varchar(15) DEFAULT NULL,
  `proveedor_nit` varchar(20) DEFAULT NULL,
  `proveedor_direccion` text DEFAULT NULL,
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `impuestos` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total` decimal(10,2) NOT NULL,
  `notas` text DEFAULT NULL,
  `tipo` enum('PRODUCTO','REPUESTO','MIXTA') DEFAULT 'PRODUCTO',
  `estado` enum('BORRADOR','CONFIRMADA','RECIBIDA','CANCELADA') DEFAULT 'CONFIRMADA',
  `metodo_pago` enum('efectivo','transferencia','tarjeta_credito') DEFAULT NULL,
  `fuente_financiera` enum('CAJA_OPERATIVA','CAJA_CHICA','CUENTA_BANCARIA','TARJETA_CREDITO') DEFAULT NULL,
  `tarjeta_id` int(11) DEFAULT NULL,
  `cuenta_id` int(11) DEFAULT NULL,
  `estado_financiero` enum('NO_APLICA','APLICADO','REVERTIDO') NOT NULL DEFAULT 'NO_APLICA',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_compra` (`numero_compra`),
  UNIQUE KEY `uk_compras_empresa_sucursal_id` (`empresa_id`,`sucursal_id`,`id`),
  KEY `idx_numero_compra` (`numero_compra`),
  KEY `idx_fecha` (`fecha_compra`),
  KEY `idx_proveedor_nombre` (`proveedor_nombre`),
  KEY `idx_proveedor_id` (`proveedor_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_tipo` (`tipo`),
  KEY `idx_compras_empresa_id` (`empresa_id`),
  KEY `idx_compras_empresa_fecha` (`empresa_id`,`fecha_compra`),
  KEY `idx_compras_empresa_estado` (`empresa_id`,`estado`),
  KEY `idx_compras_empresa_tipo` (`empresa_id`,`tipo`),
  KEY `idx_compras_empresa_proveedor` (`empresa_id`,`proveedor_id`),
  KEY `idx_compras_empresa_metodo_pago` (`empresa_id`,`metodo_pago`),
  KEY `idx_compras_empresa_estado_financiero` (`empresa_id`,`estado_financiero`),
  KEY `idx_compras_tarjeta_id` (`tarjeta_id`),
  KEY `idx_compras_cuenta_id` (`cuenta_id`),
  KEY `idx_compras_scope_fecha` (`empresa_id`,`sucursal_id`,`fecha_compra`,`id`),
  KEY `idx_compras_fuente_financiera` (`empresa_id`,`sucursal_id`,`fuente_financiera`,`estado_financiero`),
  CONSTRAINT `fk_compra_proveedor` FOREIGN KEY (`proveedor_id`) REFERENCES `proveedores` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_compras_cuenta_bancaria` FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas_bancarias` (`id`),
  CONSTRAINT `fk_compras_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_compras_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `fk_compras_tarjeta_credito` FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas_credito` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cotizaciones`
--

DROP TABLE IF EXISTS `cotizaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cotizaciones` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `numero_cotizacion` varchar(20) NOT NULL COMMENT 'N├║mero ├║nico de cotizaci├│n (ej: COT-2025-0001)',
  `cliente_id` int(11) NOT NULL,
  `cliente_nombre` varchar(200) NOT NULL COMMENT 'Nombre completo del cliente (desnormalizado para hist├│rico)',
  `cliente_telefono` varchar(15) DEFAULT NULL,
  `cliente_email` varchar(100) DEFAULT NULL,
  `cliente_nit` varchar(20) DEFAULT NULL,
  `cliente_direccion` text DEFAULT NULL,
  `tipo` enum('VENTA','REPARACION') NOT NULL DEFAULT 'VENTA',
  `fecha_emision` date NOT NULL,
  `vigencia_dias` int(11) NOT NULL DEFAULT 15 COMMENT 'D├¡as de validez de la cotizaci├│n',
  `fecha_vencimiento` date NOT NULL COMMENT 'Calculado: fecha_emision + vigencia_dias',
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL COMMENT 'Array de items: [{id, source, refId, nombre, cantidad, precioUnit, subtotal, aplicarImpuestos, notas}]' CHECK (json_valid(`items`)),
  `subtotal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `impuestos` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'IVA calculado sobre items con aplicarImpuestos=true',
  `mano_de_obra` decimal(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Solo para tipo REPARACION',
  `total` decimal(10,2) NOT NULL DEFAULT 0.00,
  `aplicar_impuestos` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Si la cotizaci├│n maneja impuestos',
  `estado` enum('BORRADOR','ENVIADA','APROBADA','RECHAZADA','VENCIDA','CONVERTIDA') NOT NULL DEFAULT 'BORRADOR',
  `observaciones` text DEFAULT NULL,
  `notas_internas` text DEFAULT NULL COMMENT 'Notas privadas no visibles en la cotizaci├│n impresa',
  `convertida_a` enum('VENTA','REPARACION') DEFAULT NULL,
  `referencia_venta_id` int(11) DEFAULT NULL COMMENT 'ID de la venta si fue convertida',
  `referencia_reparacion_id` int(11) DEFAULT NULL COMMENT 'ID de la reparaci├│n si fue convertida',
  `fecha_conversion` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'ID del usuario que cre├│ la cotizaci├│n',
  `updated_by` int(11) DEFAULT NULL COMMENT 'ID del usuario que modific├│ la cotizaci├│n',
  `convertida` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Indica si la cotizaci├│n fue convertida (0=No, 1=S├¡)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_cotizacion` (`numero_cotizacion`),
  KEY `idx_cliente` (`cliente_id`),
  KEY `idx_tipo` (`tipo`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha_emision` (`fecha_emision`),
  KEY `idx_fecha_vencimiento` (`fecha_vencimiento`),
  KEY `idx_numero` (`numero_cotizacion`),
  KEY `idx_convertida` (`convertida`),
  KEY `idx_cotizaciones_empresa_id` (`empresa_id`),
  CONSTRAINT `cotizaciones_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_cotizaciones_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=32 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `before_insert_cotizaciones` BEFORE INSERT ON `cotizaciones` FOR EACH ROW BEGIN
    
    SET NEW.fecha_vencimiento = DATE_ADD(NEW.fecha_emision, INTERVAL NEW.vigencia_dias DAY);
    
    
    IF NEW.numero_cotizacion IS NULL OR NEW.numero_cotizacion = '' THEN
        SET @year = YEAR(NEW.fecha_emision);
        SET @max_num = (SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(numero_cotizacion, '-', -1) AS UNSIGNED)), 0) 
                       FROM cotizaciones 
                       WHERE numero_cotizacion LIKE CONCAT('COT-', @year, '-%'));
        SET NEW.numero_cotizacion = CONCAT('COT-', @year, '-', LPAD(@max_num + 1, 4, '0'));
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `before_update_cotizaciones` BEFORE UPDATE ON `cotizaciones` FOR EACH ROW BEGIN
    
    IF NEW.fecha_emision != OLD.fecha_emision OR NEW.vigencia_dias != OLD.vigencia_dias THEN
        SET NEW.fecha_vencimiento = DATE_ADD(NEW.fecha_emision, INTERVAL NEW.vigencia_dias DAY);
    END IF;
    
    
    IF NEW.estado IN ('ENVIADA', 'BORRADOR') AND NEW.fecha_vencimiento < CURDATE() THEN
        SET NEW.estado = 'VENCIDA';
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `cuentas_bancarias`
--

DROP TABLE IF EXISTS `cuentas_bancarias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `cuentas_bancarias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL DEFAULT 1,
  `nombre` varchar(100) NOT NULL,
  `numero_cuenta` varchar(50) DEFAULT NULL,
  `tipo_cuenta` varchar(50) DEFAULT 'Corriente',
  `saldo_actual` decimal(10,2) DEFAULT 0.00,
  `pos_asociado` varchar(100) DEFAULT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_cuentas_bancarias_empresa_id` (`empresa_id`),
  CONSTRAINT `fk_cuentas_bancarias_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `deudores`
--

DROP TABLE IF EXISTS `deudores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `deudores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `numero_credito` varchar(20) NOT NULL,
  `tipo_origen` enum('VENTA','REPARACION','MANUAL') NOT NULL DEFAULT 'MANUAL',
  `cliente_id` int(11) DEFAULT NULL,
  `cliente_nombre` varchar(150) NOT NULL,
  `cliente_telefono` varchar(15) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `monto_total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `monto_pagado` decimal(12,2) NOT NULL DEFAULT 0.00,
  `saldo_pendiente` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fecha_vencimiento` date DEFAULT NULL,
  `estado` enum('PENDIENTE','PARCIAL','PAGADO','ANULADO') NOT NULL DEFAULT 'PENDIENTE',
  `referencia_venta_id` int(11) DEFAULT NULL,
  `referencia_reparacion_id` varchar(50) DEFAULT NULL,
  `numero_cuotas` int(11) NOT NULL DEFAULT 1,
  `monto_cuota` decimal(12,2) NOT NULL DEFAULT 0.00,
  `frecuencia_pago` enum('SEMANAL','QUINCENAL','MENSUAL') DEFAULT 'MENSUAL',
  `fecha_primer_pago` date DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `items_detalle` text DEFAULT NULL,
  `created_by` varchar(100) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `motivo_anulacion` text DEFAULT NULL,
  `fecha_anulacion` datetime DEFAULT NULL,
  `anulado_por` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_deudores_empresa_credito` (`empresa_id`,`numero_credito`),
  KEY `idx_deudores_cliente` (`cliente_id`),
  KEY `idx_deudores_estado` (`estado`),
  KEY `idx_deudores_empresa_id` (`empresa_id`),
  KEY `idx_deudores_empresa_cliente` (`empresa_id`,`cliente_id`),
  KEY `idx_deudores_empresa_estado` (`empresa_id`,`estado`),
  KEY `idx_deudores_empresa_origen` (`empresa_id`,`tipo_origen`),
  KEY `idx_deudores_empresa_sucursal_estado` (`empresa_id`,`sucursal_id`,`estado`,`id`),
  CONSTRAINT `fk_deudores_cliente` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_deudores_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_deudores_empresa_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER before_insert_deudores
BEFORE INSERT ON deudores
FOR EACH ROW
BEGIN
  DECLARE next_num INT;

  SELECT
    COALESCE(
      MAX(
        CAST(
          SUBSTRING_INDEX(numero_credito, '-', -1)
          AS UNSIGNED
        )
      ),
      0
    ) + 1
  INTO next_num
  FROM deudores
  WHERE empresa_id = NEW.empresa_id
    AND numero_credito LIKE CONCAT(
      'CR-',
      YEAR(CURDATE()),
      '-%'
    );

  SET NEW.numero_credito = CONCAT(
    'CR-',
    YEAR(CURDATE()),
    '-',
    LPAD(next_num, 4, '0')
  );

  SET NEW.saldo_pendiente =
    NEW.monto_total - NEW.monto_pagado;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `deudores_pagos`
--

DROP TABLE IF EXISTS `deudores_pagos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `deudores_pagos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `deudor_id` int(11) NOT NULL,
  `numero_cuota` int(11) DEFAULT NULL,
  `monto` decimal(12,2) NOT NULL,
  `monto_programado` decimal(12,2) NOT NULL DEFAULT 0.00,
  `fecha_vencimiento` date DEFAULT NULL,
  `estado_cuota` enum('PENDIENTE','PARCIAL','PAGADO','VENCIDO','ANULADA') DEFAULT NULL,
  `metodo_pago` varchar(30) NOT NULL DEFAULT 'EFECTIVO',
  `referencia` varchar(100) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `realizado_por` varchar(100) DEFAULT NULL,
  `fecha_pago` datetime NOT NULL DEFAULT current_timestamp(),
  `porcentaje_recargo` decimal(5,2) NOT NULL DEFAULT 0.00,
  `monto_recargo` decimal(10,2) NOT NULL DEFAULT 0.00,
  `total_cobrado` decimal(10,2) NOT NULL DEFAULT 0.00,
  `banco_movimiento_id` int(11) DEFAULT NULL,
  `caja_movimiento_id` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pagos_deudor` (`deudor_id`),
  KEY `idx_dp_banco_mov` (`banco_movimiento_id`),
  KEY `idx_dp_caja_mov` (`caja_movimiento_id`),
  KEY `idx_deudores_pagos_empresa_id` (`empresa_id`),
  KEY `idx_deudores_pagos_empresa_deudor` (`empresa_id`,`deudor_id`),
  CONSTRAINT `fk_deudores_pagos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_pagos_deudor` FOREIGN KEY (`deudor_id`) REFERENCES `deudores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `empresas`
--

DROP TABLE IF EXISTS `empresas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `empresas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `nombre_comercial` varchar(150) DEFAULT NULL,
  `razon_social` varchar(180) DEFAULT NULL,
  `nit` varchar(30) DEFAULT NULL,
  `slug` varchar(120) NOT NULL,
  `estado` varchar(30) NOT NULL DEFAULT 'activa',
  `plan` varchar(50) NOT NULL DEFAULT 'demo',
  `limite_sucursales` int(11) NOT NULL DEFAULT 1,
  `fecha_inicio` date DEFAULT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `color_primario` varchar(20) DEFAULT NULL,
  `color_principal` varchar(20) DEFAULT '#2563eb',
  `moneda_codigo` varchar(10) DEFAULT 'GTQ',
  `moneda_simbolo` varchar(10) DEFAULT 'Q',
  `zona_horaria` varchar(80) DEFAULT 'America/Guatemala',
  `precio_revision_default` decimal(10,2) DEFAULT NULL,
  `condiciones_servicio_contrato` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_empresas_slug` (`slug`),
  KEY `idx_empresas_estado` (`estado`),
  KEY `idx_empresas_estado_plan` (`estado`,`plan`),
  CONSTRAINT `chk_empresas_limite_sucursales` CHECK (`limite_sucursales` >= 1)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `equipos_marcas`
--

DROP TABLE IF EXISTS `equipos_marcas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipos_marcas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `tipo_equipo` enum('Telefono','Laptop','Tablet','Consola','Otro') NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_equipos_marcas_empresa_nombre_tipo` (`empresa_id`,`nombre`,`tipo_equipo`),
  KEY `idx_tipo` (`tipo_equipo`),
  KEY `idx_activo` (`activo`),
  KEY `idx_equipos_marcas_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=138 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `equipos_modelos`
--

DROP TABLE IF EXISTS `equipos_modelos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `equipos_modelos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `marca_id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_modelo_marca` (`marca_id`,`nombre`),
  UNIQUE KEY `uniq_equipos_modelos_empresa_marca_nombre` (`empresa_id`,`marca_id`,`nombre`),
  KEY `idx_marca` (`marca_id`),
  KEY `idx_activo` (`activo`),
  KEY `idx_equipos_modelos_empresa` (`empresa_id`),
  CONSTRAINT `equipos_modelos_ibfk_1` FOREIGN KEY (`marca_id`) REFERENCES `equipos_marcas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=553 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `historial_suscripciones`
--

DROP TABLE IF EXISTS `historial_suscripciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_suscripciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `suscripcion_id` bigint(20) unsigned NOT NULL,
  `empresa_id` int(11) NOT NULL,
  `tipo_evento` varchar(50) NOT NULL,
  `estado_empresa_anterior` varchar(30) DEFAULT NULL,
  `estado_empresa_nuevo` varchar(30) DEFAULT NULL,
  `estado_suscripcion_anterior` varchar(20) DEFAULT NULL,
  `estado_suscripcion_nuevo` varchar(20) DEFAULT NULL,
  `fecha_inicio_anterior` date DEFAULT NULL,
  `fecha_inicio_nueva` date DEFAULT NULL,
  `fecha_vencimiento_anterior` date DEFAULT NULL,
  `fecha_vencimiento_nueva` date DEFAULT NULL,
  `dias_gracia_anterior` int(11) DEFAULT NULL,
  `dias_gracia_nuevo` int(11) DEFAULT NULL,
  `meses_renovados` int(11) DEFAULT NULL,
  `motivo` varchar(500) DEFAULT NULL,
  `super_admin_id` int(11) DEFAULT NULL,
  `origen` varchar(30) NOT NULL,
  `datos_anteriores` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_anteriores`)),
  `datos_nuevos` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`datos_nuevos`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_historial_suscripcion` (`suscripcion_id`,`created_at`),
  KEY `idx_historial_empresa` (`empresa_id`,`created_at`),
  KEY `idx_historial_evento` (`tipo_evento`,`created_at`),
  KEY `idx_historial_super_admin` (`super_admin_id`),
  CONSTRAINT `fk_historial_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_historial_super_admin` FOREIGN KEY (`super_admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_historial_suscripcion` FOREIGN KEY (`suscripcion_id`) REFERENCES `suscripciones` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `interacciones_clientes`
--

DROP TABLE IF EXISTS `interacciones_clientes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `interacciones_clientes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `cliente_id` int(11) NOT NULL,
  `tipo` enum('cotizacion','venta','reparacion','visita') NOT NULL,
  `referencia_id` int(11) DEFAULT NULL COMMENT 'ID de la cotizaci├│n/venta/reparaci├│n relacionada',
  `monto` decimal(10,2) DEFAULT NULL COMMENT 'Monto de la transacci├│n si aplica',
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'Usuario que registr├│ la interacci├│n',
  PRIMARY KEY (`id`),
  KEY `idx_cliente_tipo` (`cliente_id`,`tipo`),
  KEY `idx_fecha` (`created_at`),
  KEY `idx_tipo` (`tipo`),
  CONSTRAINT `interacciones_clientes_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `kardex`
--

DROP TABLE IF EXISTS `kardex`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `kardex` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `tipo` varchar(30) NOT NULL DEFAULT 'ajuste',
  `cantidad` int(11) NOT NULL,
  `cantidad_anterior` int(11) NOT NULL,
  `cantidad_nueva` int(11) NOT NULL,
  `nota` varchar(500) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_kardex_empresa` (`empresa_id`),
  KEY `idx_kardex_producto` (`producto_id`),
  KEY `idx_kardex_usuario` (`usuario_id`),
  KEY `idx_kardex_empresa_producto_fecha` (`empresa_id`,`producto_id`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `lineas`
--

DROP TABLE IF EXISTS `lineas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `lineas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `marca_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_marca_linea` (`marca_id`,`nombre`),
  UNIQUE KEY `uniq_lineas_empresa_marca_nombre` (`empresa_id`,`marca_id`,`nombre`),
  KEY `idx_marca` (`marca_id`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_activo` (`activo`),
  KEY `idx_lineas_empresa` (`empresa_id`),
  CONSTRAINT `lineas_ibfk_1` FOREIGN KEY (`marca_id`) REFERENCES `marcas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1240 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `marcas`
--

DROP TABLE IF EXISTS `marcas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `marcas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_marcas_empresa_nombre` (`empresa_id`,`nombre`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_activo` (`activo`),
  KEY `idx_marcas_empresa` (`empresa_id`)
) ENGINE=InnoDB AUTO_INCREMENT=144 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `modulos`
--

DROP TABLE IF EXISTS `modulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `modulos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(80) NOT NULL,
  `nombre` varchar(120) NOT NULL,
  `grupo` varchar(50) NOT NULL,
  `descripcion` varchar(500) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `siempre_habilitado` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_modulos_codigo` (`codigo`),
  KEY `idx_modulos_grupo` (`grupo`),
  KEY `idx_modulos_estado` (`activo`,`siempre_habilitado`)
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `movimientos_bancarios`
--

DROP TABLE IF EXISTS `movimientos_bancarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `movimientos_bancarios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL DEFAULT 1,
  `cuenta_id` int(11) NOT NULL,
  `tipo_movimiento` enum('INGRESO','EGRESO') NOT NULL,
  `monto` decimal(10,2) NOT NULL,
  `concepto` varchar(255) NOT NULL,
  `categoria` varchar(100) DEFAULT 'Otro',
  `estado` enum('PENDIENTE','CONFIRMADO','ANULADO') NOT NULL DEFAULT 'PENDIENTE',
  `venta_id` int(11) DEFAULT NULL,
  `numero_referencia` varchar(100) DEFAULT NULL,
  `realizado_por` varchar(100) DEFAULT NULL,
  `observaciones` text DEFAULT NULL,
  `fecha_movimiento` datetime DEFAULT current_timestamp(),
  `referencia_tipo` varchar(50) DEFAULT NULL,
  `referencia_id` varchar(50) DEFAULT NULL,
  `confirmado_por` int(11) DEFAULT NULL,
  `confirmado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cuenta_id` (`cuenta_id`),
  KEY `idx_movimientos_bancarios_confirmado_por` (`confirmado_por`),
  KEY `idx_movimientos_bancarios_empresa_id` (`empresa_id`),
  KEY `idx_movimientos_bancarios_empresa_cuenta` (`empresa_id`,`cuenta_id`),
  CONSTRAINT `fk_movimientos_bancarios_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `movimientos_bancarios_ibfk_1` FOREIGN KEY (`cuenta_id`) REFERENCES `cuentas_bancarias` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `permisos`
--

DROP TABLE IF EXISTS `permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `permisos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(100) NOT NULL,
  `modulo` varchar(80) NOT NULL,
  `accion` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_permisos_codigo` (`codigo`),
  KEY `idx_permisos_modulo` (`modulo`)
) ENGINE=InnoDB AUTO_INCREMENT=98 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `plan_modulos`
--

DROP TABLE IF EXISTS `plan_modulos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `plan_modulos` (
  `plan_id` bigint(20) unsigned NOT NULL,
  `modulo_id` bigint(20) unsigned NOT NULL,
  `habilitado` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`plan_id`,`modulo_id`),
  KEY `idx_plan_modulos_modulo` (`modulo_id`),
  CONSTRAINT `fk_plan_modulos_modulo` FOREIGN KEY (`modulo_id`) REFERENCES `modulos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_plan_modulos_plan` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `planes`
--

DROP TABLE IF EXISTS `planes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `planes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(500) DEFAULT NULL,
  `precio_mensual` decimal(10,2) NOT NULL DEFAULT 0.00,
  `precio_anual` decimal(10,2) DEFAULT NULL,
  `moneda` varchar(10) NOT NULL DEFAULT 'GTQ',
  `max_usuarios` int(11) DEFAULT NULL,
  `max_sucursales` int(11) DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `es_publico` tinyint(1) NOT NULL DEFAULT 1,
  `asignable` tinyint(1) NOT NULL DEFAULT 1,
  `orden` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_planes_codigo` (`codigo`),
  KEY `idx_planes_estado` (`activo`,`es_publico`,`asignable`),
  KEY `idx_planes_orden` (`orden`),
  CONSTRAINT `chk_planes_precio_mensual` CHECK (`precio_mensual` >= 0),
  CONSTRAINT `chk_planes_precio_anual` CHECK (`precio_anual` is null or `precio_anual` >= 0),
  CONSTRAINT `chk_planes_max_usuarios` CHECK (`max_usuarios` is null or `max_usuarios` >= 0),
  CONSTRAINT `chk_planes_max_sucursales` CHECK (`max_sucursales` is null or `max_sucursales` >= 0)
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `producto_existencias`
--

DROP TABLE IF EXISTS `producto_existencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto_existencias` (
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `producto_id` int(11) NOT NULL,
  `existencia` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`empresa_id`,`sucursal_id`,`producto_id`),
  UNIQUE KEY `uk_producto_existencia_sucursal` (`empresa_id`,`producto_id`,`sucursal_id`),
  KEY `idx_producto_existencias_consulta` (`empresa_id`,`producto_id`,`sucursal_id`,`existencia`),
  CONSTRAINT `fk_producto_existencias_producto` FOREIGN KEY (`empresa_id`, `producto_id`) REFERENCES `productos` (`empresa_id`, `id`),
  CONSTRAINT `fk_producto_existencias_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `chk_producto_existencias_no_negativa` CHECK (`existencia` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `producto_imagenes`
--

DROP TABLE IF EXISTS `producto_imagenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto_imagenes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `producto_id` int(11) NOT NULL,
  `url` varchar(500) NOT NULL COMMENT 'Ruta o URL de la imagen',
  `orden` tinyint(4) NOT NULL DEFAULT 0 COMMENT 'Orden de visualización (0=principal)',
  `descripcion` varchar(255) DEFAULT NULL COMMENT 'Descripción alternativa de la imagen',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_producto` (`producto_id`),
  KEY `idx_orden` (`orden`),
  CONSTRAINT `producto_imagenes_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bi_producto_imagenes_max3` BEFORE INSERT ON `producto_imagenes` FOR EACH ROW BEGIN
  DECLARE total INT;

  SELECT COUNT(*) INTO total
  FROM producto_imagenes
  WHERE producto_id = NEW.producto_id;

  IF total >= 3 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Este producto ya tiene 3 imágenes (máximo permitido).';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `bu_producto_imagenes_max3` BEFORE UPDATE ON `producto_imagenes` FOR EACH ROW BEGIN
  DECLARE total INT DEFAULT 0;

  IF NEW.producto_id <> OLD.producto_id THEN
    SELECT COUNT(*) INTO total
    FROM producto_imagenes
    WHERE producto_id = NEW.producto_id;

    IF total >= 3 THEN
      SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El producto destino ya tiene 3 imágenes (máximo permitido).';
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `producto_movimientos`
--

DROP TABLE IF EXISTS `producto_movimientos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto_movimientos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `producto_id` int(11) NOT NULL,
  `tipo` varchar(30) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `existencia_anterior` int(11) NOT NULL,
  `existencia_nueva` int(11) NOT NULL,
  `nota` varchar(500) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_producto_movimientos_kardex` (`empresa_id`,`sucursal_id`,`producto_id`,`created_at`,`id`),
  KEY `idx_producto_movimientos_usuario` (`usuario_id`),
  CONSTRAINT `fk_producto_movimientos_existencia` FOREIGN KEY (`empresa_id`, `sucursal_id`, `producto_id`) REFERENCES `producto_existencias` (`empresa_id`, `sucursal_id`, `producto_id`),
  CONSTRAINT `fk_producto_movimientos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_producto_movimientos_resultado` CHECK (`existencia_anterior` >= 0 and `existencia_nueva` >= 0 and `cantidad` <> 0)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `producto_series`
--

DROP TABLE IF EXISTS `producto_series`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto_series` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `producto_id` int(11) NOT NULL,
  `sku` varchar(100) NOT NULL,
  `numero_serie` varchar(100) NOT NULL,
  `compra_id` int(11) DEFAULT NULL,
  `compra_item_id` int(11) DEFAULT NULL,
  `estado` enum('DISPONIBLE','VENDIDO','DEFECTUOSO','EN_REPARACION') DEFAULT 'DISPONIBLE',
  `venta_id` int(11) DEFAULT NULL,
  `fecha_ingreso` timestamp NOT NULL DEFAULT current_timestamp(),
  `fecha_venta` timestamp NULL DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_serie` (`numero_serie`),
  KEY `compra_item_id` (`compra_item_id`),
  KEY `idx_producto` (`producto_id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_numero_serie` (`numero_serie`),
  KEY `idx_estado` (`estado`),
  KEY `idx_compra` (`compra_id`),
  KEY `idx_producto_series_empresa_id` (`empresa_id`),
  KEY `idx_producto_series_empresa_producto` (`empresa_id`,`producto_id`),
  KEY `idx_producto_series_empresa_compra` (`empresa_id`,`compra_id`),
  KEY `idx_producto_series_empresa_compra_item` (`empresa_id`,`compra_item_id`),
  CONSTRAINT `fk_producto_series_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `producto_series_ibfk_1` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`) ON DELETE SET NULL,
  CONSTRAINT `producto_series_ibfk_2` FOREIGN KEY (`compra_item_id`) REFERENCES `compra_items` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sku` varchar(50) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `categoria` varchar(100) NOT NULL,
  `subcategoria` varchar(100) DEFAULT NULL,
  `precio_costo` decimal(10,2) NOT NULL COMMENT 'Precio de compra/costo del producto',
  `precio_venta` decimal(10,2) NOT NULL COMMENT 'Precio de venta al público',
  `stock` int(11) NOT NULL DEFAULT 0,
  `stock_minimo` int(11) NOT NULL DEFAULT 0,
  `aplica_serie` tinyint(1) DEFAULT 0 COMMENT 'Indica si el producto requiere n??mero de serie/IMEI',
  `sku_generado` tinyint(1) DEFAULT 0 COMMENT 'Indica si el SKU fue generado autom??ticamente',
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `sku` (`sku`),
  UNIQUE KEY `uk_productos_empresa_id` (`empresa_id`,`id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_categoria` (`categoria`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_activo` (`activo`),
  KEY `idx_productos_empresa_id` (`empresa_id`),
  CONSTRAINT `fk_productos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=58 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `proveedores`
--

DROP TABLE IF EXISTS `proveedores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `proveedores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `contacto` varchar(255) DEFAULT NULL COMMENT 'Nombre de la persona de contacto',
  `telefono` varchar(15) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `direccion` text DEFAULT NULL,
  `nit` varchar(50) DEFAULT NULL,
  `empresa` varchar(255) DEFAULT NULL,
  `sitio_web` varchar(255) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_nit` (`nit`),
  KEY `idx_activo` (`activo`),
  KEY `idx_proveedores_empresa_id` (`empresa_id`),
  KEY `idx_proveedores_empresa_activo` (`empresa_id`,`activo`),
  KEY `idx_proveedores_empresa_nombre` (`empresa_id`,`nombre`),
  KEY `idx_proveedores_id_empresa` (`id`,`empresa_id`),
  CONSTRAINT `fk_proveedores_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparacion_inventario_aplicaciones`
--

DROP TABLE IF EXISTS `reparacion_inventario_aplicaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparacion_inventario_aplicaciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `reparacion_id` varchar(50) NOT NULL,
  `repuesto_id` int(11) NOT NULL,
  `linea` int(11) NOT NULL DEFAULT 0,
  `cantidad` int(11) NOT NULL,
  `accion` enum('APLICACION','REVERSA') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reparacion_inv` (`empresa_id`,`sucursal_id`,`reparacion_id`,`repuesto_id`,`linea`,`accion`),
  KEY `idx_reparacion_inv_rep` (`empresa_id`,`sucursal_id`,`reparacion_id`),
  CONSTRAINT `fk_reparacion_inv_suc` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparacion_movimientos_financieros`
--

DROP TABLE IF EXISTS `reparacion_movimientos_financieros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparacion_movimientos_financieros` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `reparacion_id` varchar(50) NOT NULL,
  `pago_indice` int(11) NOT NULL,
  `accion` enum('INGRESO','REVERSA') NOT NULL,
  `metodo` varchar(30) NOT NULL,
  `monto_centavos` int(11) NOT NULL,
  `caja_id` bigint(20) unsigned DEFAULT NULL,
  `caja_sesion_id` bigint(20) unsigned DEFAULT NULL,
  `referencia` varchar(100) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reparacion_fin` (`empresa_id`,`sucursal_id`,`reparacion_id`,`pago_indice`,`accion`),
  KEY `idx_reparacion_fin_rep` (`empresa_id`,`sucursal_id`,`reparacion_id`),
  KEY `idx_reparacion_fin_caja_sesion` (`empresa_id`,`sucursal_id`,`caja_id`,`caja_sesion_id`),
  CONSTRAINT `fk_reparacion_fin_caja_sesion` FOREIGN KEY (`empresa_id`, `sucursal_id`, `caja_id`, `caja_sesion_id`) REFERENCES `caja_sesiones` (`empresa_id`, `sucursal_id`, `caja_id`, `id`),
  CONSTRAINT `fk_reparacion_fin_suc` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparacion_regalia_inventario_aplicaciones`
--

DROP TABLE IF EXISTS `reparacion_regalia_inventario_aplicaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparacion_regalia_inventario_aplicaciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `reparacion_id` varchar(50) NOT NULL,
  `tipo_item` enum('PRODUCTO','REPUESTO') NOT NULL,
  `item_id` int(11) NOT NULL,
  `linea` int(11) NOT NULL DEFAULT 0,
  `cantidad` int(11) NOT NULL,
  `accion` enum('APLICACION','REVERSA') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_reparacion_regalia_inv` (`empresa_id`,`sucursal_id`,`reparacion_id`,`tipo_item`,`item_id`,`linea`,`accion`),
  KEY `idx_reparacion_regalia_inv` (`empresa_id`,`sucursal_id`,`reparacion_id`),
  CONSTRAINT `fk_reparacion_regalia_inv_suc` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `chk_reparacion_regalia_cantidad` CHECK (`cantidad` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparacion_regalias`
--

DROP TABLE IF EXISTS `reparacion_regalias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparacion_regalias` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `reparacion_id` varchar(50) NOT NULL,
  `item_id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `tipo_inventario` varchar(20) NOT NULL DEFAULT 'repuesto',
  `cantidad` int(11) NOT NULL,
  `costo_unitario` int(11) NOT NULL DEFAULT 0,
  `subtotal` int(11) NOT NULL DEFAULT 0,
  `nota` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rep_regalias_reparacion` (`reparacion_id`),
  KEY `idx_rep_regalias_item` (`item_id`),
  KEY `idx_rep_regalias_tipo` (`tipo_inventario`),
  CONSTRAINT `fk_rep_regalias_reparacion` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparacion_repuestos`
--

DROP TABLE IF EXISTS `reparacion_repuestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparacion_repuestos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) DEFAULT NULL,
  `sucursal_id` bigint(20) unsigned DEFAULT NULL,
  `reparacion_id` varchar(50) NOT NULL,
  `repuesto_id` int(11) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `costo_unitario` int(11) NOT NULL DEFAULT 0,
  `subtotal` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_rep_repuestos_reparacion` (`reparacion_id`),
  KEY `idx_rep_repuestos_repuesto` (`repuesto_id`),
  CONSTRAINT `fk_rep_repuestos_reparacion` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_rep_repuestos_repuesto` FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparaciones`
--

DROP TABLE IF EXISTS `reparaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparaciones` (
  `id` varchar(50) NOT NULL,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `cliente_id` int(11) DEFAULT NULL,
  `cliente_nombre` varchar(200) NOT NULL,
  `cliente_telefono` varchar(15) DEFAULT NULL,
  `cliente_email` varchar(200) DEFAULT NULL,
  `tipo_equipo` enum('Telefono','Tablet','Laptop','Consola','Otro') NOT NULL,
  `marca` varchar(100) DEFAULT NULL,
  `modelo` varchar(150) DEFAULT NULL,
  `color` varchar(50) DEFAULT NULL,
  `imei_serie` varchar(100) DEFAULT NULL,
  `patron_contrasena` varchar(255) DEFAULT NULL,
  `acceso_tipo` varchar(50) DEFAULT 'ninguno',
  `acceso_valor` varchar(255) DEFAULT NULL,
  `estado_fisico` text DEFAULT NULL,
  `diagnostico_inicial` text DEFAULT NULL,
  `estado` enum('RECIBIDA','EN_DIAGNOSTICO','ESPERANDO_AUTORIZACION','AUTORIZADA','EN_REPARACION','EN_PROCESO','ESPERANDO_PIEZA','COMPLETADA','ENTREGADA','CANCELADA','STAND_BY','ANTICIPO_REGISTRADO') NOT NULL DEFAULT 'RECIBIDA',
  `sub_etapa` enum('DIAGNOSTICO','DESARMADO','REPARACION','ARMADO','PRUEBAS','CALIBRACION') DEFAULT NULL,
  `prioridad` enum('BAJA','MEDIA','ALTA') NOT NULL DEFAULT 'MEDIA',
  `tecnico_asignado` varchar(100) DEFAULT NULL,
  `mano_obra` int(11) DEFAULT 0,
  `subtotal` int(11) DEFAULT 0,
  `impuestos` int(11) DEFAULT 0,
  `total` int(11) DEFAULT 0,
  `monto_anticipo` int(11) DEFAULT 0,
  `saldo_anticipo` int(11) DEFAULT 0,
  `monto_pagado_adicional` int(11) NOT NULL DEFAULT 0,
  `metodo_pago_adicional` varchar(30) DEFAULT NULL,
  `metodo_anticipo` enum('efectivo','transferencia','tarjeta_bac','tarjeta_neonet','tarjeta_otra') DEFAULT NULL,
  `total_invertido` int(11) DEFAULT 0,
  `diferencia_reparacion` int(11) DEFAULT 0,
  `total_ganancia` int(11) DEFAULT 0,
  `sticker_serie_interna` varchar(50) DEFAULT NULL,
  `sticker_ubicacion` enum('chasis','bandeja_sim','bateria','otro') DEFAULT NULL,
  `fecha_ingreso` date NOT NULL,
  `fecha_estimada_entrega` date DEFAULT NULL,
  `fecha_entrega_programada` date DEFAULT NULL,
  `nota_entrega_programada` text DEFAULT NULL,
  `fecha_entrega` datetime DEFAULT NULL,
  `fecha_cierre` date DEFAULT NULL,
  `garantia_dias` int(11) DEFAULT 30,
  `garantia_meses` int(11) DEFAULT 1,
  `observaciones` text DEFAULT NULL,
  `precio_revision_contrato` decimal(10,2) DEFAULT NULL,
  `condiciones_servicio_contrato` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` varchar(100) DEFAULT NULL,
  `updated_by` varchar(100) DEFAULT NULL,
  `cuenta_bancaria_anticipo_id` int(11) DEFAULT NULL,
  `tecnico_asignado_id` int(11) DEFAULT NULL,
  `asignado_por` int(11) DEFAULT NULL,
  `fecha_asignacion` datetime DEFAULT NULL,
  `asignado_en` datetime DEFAULT NULL,
  `firma_cliente_url` varchar(500) DEFAULT NULL,
  `firma_receptor_url` varchar(500) DEFAULT NULL,
  `firma_estado` varchar(50) DEFAULT NULL,
  `firmado_at` datetime DEFAULT NULL,
  `firmado_en` datetime DEFAULT NULL,
  `firmado_por_usuario_id` int(11) DEFAULT NULL,
  `fecha_cancelacion` date DEFAULT NULL,
  `motivo_cancelacion` text DEFAULT NULL,
  `devolucion_monto` decimal(10,2) DEFAULT 0.00,
  `monto_retenido` decimal(10,2) DEFAULT 0.00,
  `motivo_retencion` text DEFAULT NULL,
  `anticipo_movimiento_id` int(11) DEFAULT NULL,
  `devolucion_movimiento_id` int(11) DEFAULT NULL,
  `monto_pago_final` int(11) NOT NULL DEFAULT 0,
  `metodo_pago_final` varchar(30) DEFAULT NULL,
  `fecha_pago_final` date DEFAULT NULL,
  `observacion_pago_final` text DEFAULT NULL,
  `estado_pago` varchar(20) NOT NULL DEFAULT 'pendiente',
  `total_pagado` int(11) NOT NULL DEFAULT 0,
  `ganancia_neta` int(11) NOT NULL DEFAULT 0,
  `costo_repuestos_total` int(11) NOT NULL DEFAULT 0,
  `costo_regalias_total` int(11) NOT NULL DEFAULT 0,
  `cuenta_bancaria_id` int(11) DEFAULT NULL,
  `porcentaje_interes` decimal(5,2) NOT NULL DEFAULT 0.00,
  `interes_monto` int(11) NOT NULL DEFAULT 0,
  `referencia_pago` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `sticker_serie_interna` (`sticker_serie_interna`),
  KEY `idx_cliente_nombre` (`cliente_nombre`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha_ingreso` (`fecha_ingreso`),
  KEY `idx_sticker` (`sticker_serie_interna`),
  KEY `cliente_id` (`cliente_id`),
  KEY `idx_reparaciones_tecnico_asignado` (`tecnico_asignado_id`),
  KEY `idx_reparaciones_asignado_por` (`asignado_por`),
  KEY `idx_reparaciones_empresa_id` (`empresa_id`),
  KEY `idx_reparaciones_scope` (`empresa_id`,`sucursal_id`),
  KEY `idx_reparaciones_scope_fecha` (`empresa_id`,`sucursal_id`,`fecha_ingreso`,`id`),
  CONSTRAINT `fk_reparaciones_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_reparaciones_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `reparaciones_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparaciones_accesorios`
--

DROP TABLE IF EXISTS `reparaciones_accesorios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparaciones_accesorios` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reparacion_id` varchar(50) NOT NULL,
  `chip` tinyint(1) DEFAULT 0,
  `estuche` tinyint(1) DEFAULT 0,
  `memoria_sd` tinyint(1) DEFAULT 0,
  `cargador` tinyint(1) DEFAULT 0,
  `otros` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_reparacion` (`reparacion_id`),
  CONSTRAINT `reparaciones_accesorios_ibfk_1` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparaciones_historial`
--

DROP TABLE IF EXISTS `reparaciones_historial`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparaciones_historial` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reparacion_id` varchar(50) NOT NULL,
  `estado` enum('RECIBIDA','EN_DIAGNOSTICO','ESPERANDO_AUTORIZACION','AUTORIZADA','EN_REPARACION','ESPERANDO_PIEZA','COMPLETADA','ENTREGADA','CANCELADA','STAND_BY','ANTICIPO_REGISTRADO') NOT NULL,
  `sub_etapa` enum('DIAGNOSTICO','DESARMADO','REPARACION','ARMADO','PRUEBAS','CALIBRACION') DEFAULT NULL,
  `nota` text NOT NULL,
  `pieza_necesaria` varchar(255) DEFAULT NULL,
  `proveedor` varchar(255) DEFAULT NULL,
  `costo_repuesto` int(11) DEFAULT NULL,
  `sticker_numero` varchar(50) DEFAULT NULL,
  `sticker_ubicacion` enum('chasis','bandeja_sim','bateria','otro') DEFAULT NULL,
  `diferencia_reparacion` int(11) DEFAULT NULL,
  `user_nombre` varchar(100) DEFAULT 'Sistema',
  `tipo_evento` varchar(80) DEFAULT NULL,
  `estado_anterior` varchar(80) DEFAULT NULL,
  `descripcion` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reparacion` (`reparacion_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `reparaciones_historial_ibfk_1` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=123 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparaciones_imagenes`
--

DROP TABLE IF EXISTS `reparaciones_imagenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparaciones_imagenes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reparacion_id` varchar(50) NOT NULL,
  `historial_id` int(11) DEFAULT NULL,
  `tipo` enum('recepcion','historial','final','comprobante') NOT NULL,
  `filename` varchar(255) NOT NULL,
  `url_path` varchar(500) NOT NULL,
  `file_size` int(11) DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reparacion` (`reparacion_id`),
  KEY `idx_historial` (`historial_id`),
  KEY `idx_tipo` (`tipo`),
  CONSTRAINT `reparaciones_imagenes_ibfk_1` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reparaciones_imagenes_ibfk_2` FOREIGN KEY (`historial_id`) REFERENCES `reparaciones_historial` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `reparaciones_items`
--

DROP TABLE IF EXISTS `reparaciones_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `reparaciones_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reparacion_id` varchar(50) NOT NULL,
  `item_id` varchar(50) DEFAULT NULL,
  `item_tipo` enum('producto','repuesto','manual') NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 1,
  `precio_unit` int(11) NOT NULL,
  `subtotal` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_reparacion` (`reparacion_id`),
  CONSTRAINT `reparaciones_items_ibfk_1` FOREIGN KEY (`reparacion_id`) REFERENCES `reparaciones` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repuesto_existencias`
--

DROP TABLE IF EXISTS `repuesto_existencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuesto_existencias` (
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `repuesto_id` int(11) NOT NULL,
  `existencia` int(11) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`empresa_id`,`sucursal_id`,`repuesto_id`),
  UNIQUE KEY `uk_repuesto_existencia_sucursal` (`empresa_id`,`repuesto_id`,`sucursal_id`),
  KEY `idx_repuesto_existencias_consulta` (`empresa_id`,`repuesto_id`,`sucursal_id`,`existencia`),
  CONSTRAINT `fk_repuesto_existencias_repuesto` FOREIGN KEY (`empresa_id`, `repuesto_id`) REFERENCES `repuestos` (`empresa_id`, `id`),
  CONSTRAINT `fk_repuesto_existencias_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `chk_repuesto_existencia_no_negativa` CHECK (`existencia` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repuesto_marcas`
--

DROP TABLE IF EXISTS `repuesto_marcas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuesto_marcas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_marcas_tipo_nombre` (`tipo_id`,`nombre`),
  CONSTRAINT `fk_rmarca_tipo` FOREIGN KEY (`tipo_id`) REFERENCES `repuesto_tipos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=37 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repuesto_modelos`
--

DROP TABLE IF EXISTS `repuesto_modelos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuesto_modelos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `tipo_id` int(11) NOT NULL,
  `marca_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_modelos` (`tipo_id`,`marca_id`,`nombre`),
  KEY `fk_rmodelo_marca` (`marca_id`),
  CONSTRAINT `fk_rmodelo_marca` FOREIGN KEY (`marca_id`) REFERENCES `repuesto_marcas` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `fk_rmodelo_tipo` FOREIGN KEY (`tipo_id`) REFERENCES `repuesto_tipos` (`id`) ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repuesto_movimientos`
--

DROP TABLE IF EXISTS `repuesto_movimientos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuesto_movimientos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `repuesto_id` int(11) NOT NULL,
  `tipo` varchar(30) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `existencia_anterior` int(11) NOT NULL,
  `existencia_nueva` int(11) NOT NULL,
  `nota` varchar(500) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `compra_id` int(11) DEFAULT NULL,
  `compra_item_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_movimiento_compra` (`empresa_id`,`sucursal_id`,`compra_item_id`,`tipo`),
  KEY `idx_repuesto_movimientos_kardex` (`empresa_id`,`sucursal_id`,`repuesto_id`,`created_at`,`id`),
  KEY `fk_repuesto_movimientos_usuario` (`usuario_id`),
  KEY `fk_repuesto_movimientos_compra` (`compra_id`),
  KEY `fk_repuesto_movimientos_item` (`compra_item_id`),
  CONSTRAINT `fk_repuesto_movimientos_compra` FOREIGN KEY (`compra_id`) REFERENCES `compras` (`id`),
  CONSTRAINT `fk_repuesto_movimientos_existencia` FOREIGN KEY (`empresa_id`, `sucursal_id`, `repuesto_id`) REFERENCES `repuesto_existencias` (`empresa_id`, `sucursal_id`, `repuesto_id`),
  CONSTRAINT `fk_repuesto_movimientos_item` FOREIGN KEY (`compra_item_id`) REFERENCES `compra_items` (`id`),
  CONSTRAINT `fk_repuesto_movimientos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_repuesto_movimiento_stock` CHECK (`cantidad` <> 0 and `existencia_anterior` >= 0 and `existencia_nueva` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repuesto_tipos`
--

DROP TABLE IF EXISTS `repuesto_tipos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuesto_tipos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuesto_tipos_nombre` (`nombre`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `repuestos`
--

DROP TABLE IF EXISTS `repuestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuestos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sku` varchar(50) DEFAULT NULL,
  `codigo` varchar(50) DEFAULT NULL,
  `nombre` varchar(150) NOT NULL,
  `tipo` varchar(100) NOT NULL DEFAULT 'Otro',
  `marca` varchar(100) NOT NULL DEFAULT '',
  `linea` varchar(100) DEFAULT NULL,
  `modelo` varchar(100) DEFAULT NULL,
  `compatibilidad` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`compatibilidad`)),
  `condicion` enum('Original','OEM','Gen├®rico','Usado') NOT NULL DEFAULT 'Original',
  `color` varchar(50) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `precio_publico` int(11) NOT NULL DEFAULT 0 COMMENT 'Precio de venta al p├║blico en centavos',
  `precio_costo` int(11) NOT NULL DEFAULT 0 COMMENT 'Precio de costo en centavos',
  `proveedor` varchar(100) DEFAULT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `stock_minimo` int(11) DEFAULT 1,
  `imagenes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`imagenes`)),
  `tags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`tags`)),
  `activo` tinyint(1) DEFAULT 1,
  `sku_generado` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_repuestos_empresa_id` (`empresa_id`,`id`),
  UNIQUE KEY `sku` (`sku`),
  KEY `idx_nombre` (`nombre`),
  KEY `idx_tipo` (`tipo`),
  KEY `idx_marca` (`marca`),
  KEY `idx_linea` (`linea`),
  KEY `idx_activo` (`activo`),
  KEY `idx_stock` (`stock`),
  KEY `idx_repuestos_empresa_id` (`empresa_id`),
  CONSTRAINT `fk_repuestos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `before_insert_repuesto` BEFORE INSERT ON `repuestos` FOR EACH ROW BEGIN
  
  SET NEW.nombre = TRIM(NEW.nombre);
  IF NEW.linea IS NOT NULL THEN
    SET NEW.linea = TRIM(NEW.linea);
  END IF;
  IF NEW.modelo IS NOT NULL THEN
    SET NEW.modelo = TRIM(NEW.modelo);
  END IF;
  
  
  IF NEW.precio_publico > 0 AND NEW.precio_costo > 0 AND NEW.precio_publico <= NEW.precio_costo THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'El precio p├║blico debe ser mayor al precio de costo';
  END IF;
  
  
  IF NEW.stock < 0 THEN
    SET NEW.stock = 0;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `before_update_repuesto` BEFORE UPDATE ON `repuestos` FOR EACH ROW BEGIN
  
  SET NEW.nombre = TRIM(NEW.nombre);
  IF NEW.linea IS NOT NULL THEN
    SET NEW.linea = TRIM(NEW.linea);
  END IF;
  IF NEW.modelo IS NOT NULL THEN
    SET NEW.modelo = TRIM(NEW.modelo);
  END IF;
  
  
  IF NEW.precio_publico > 0 AND NEW.precio_costo > 0 AND NEW.precio_publico <= NEW.precio_costo THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'El precio p├║blico debe ser mayor al precio de costo';
  END IF;
  
  
  IF NEW.stock < 0 THEN
    SET NEW.stock = 0;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `repuestos_movimientos`
--

DROP TABLE IF EXISTS `repuestos_movimientos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `repuestos_movimientos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `repuesto_id` int(11) NOT NULL,
  `tipo_movimiento` enum('ENTRADA','SALIDA','AJUSTE','VENTA','REPARACION','DEVOLUCION') NOT NULL,
  `cantidad` int(11) NOT NULL,
  `stock_anterior` int(11) NOT NULL,
  `stock_nuevo` int(11) NOT NULL,
  `precio_unitario` int(11) DEFAULT 0 COMMENT 'Precio en centavos al momento del movimiento',
  `referencia_tipo` enum('COMPRA','VENTA','REPARACION','AJUSTE_MANUAL') DEFAULT 'AJUSTE_MANUAL',
  `referencia_id` varchar(50) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_repuesto` (`repuesto_id`),
  KEY `idx_tipo` (`tipo_movimiento`),
  KEY `idx_fecha` (`created_at`),
  CONSTRAINT `repuestos_movimientos_ibfk_1` FOREIGN KEY (`repuesto_id`) REFERENCES `repuestos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `rol_permisos`
--

DROP TABLE IF EXISTS `rol_permisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `rol_permisos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `rol_id` int(11) NOT NULL,
  `permiso_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_rol_permisos_empresa_rol_permiso` (`empresa_id`,`rol_id`,`permiso_id`),
  KEY `idx_rol_permisos_empresa_rol` (`empresa_id`,`rol_id`),
  KEY `idx_rol_permisos_permiso` (`permiso_id`),
  KEY `fk_rol_permisos_rol` (`rol_id`),
  CONSTRAINT `fk_rol_permisos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rol_permisos_permiso` FOREIGN KEY (`permiso_id`) REFERENCES `permisos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_rol_permisos_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=1160 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_rol_permisos_empresa_bi
BEFORE INSERT ON rol_permisos
FOR EACH ROW
BEGIN
  DECLARE v_role_empresa INT;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.rol_id;
  IF v_role_empresa <> NEW.empresa_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rol_permisos: empresa_id no coincide con el rol';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_rol_permisos_empresa_bu
BEFORE UPDATE ON rol_permisos
FOR EACH ROW
BEGIN
  DECLARE v_role_empresa INT;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.rol_id;
  IF v_role_empresa <> NEW.empresa_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'rol_permisos: empresa_id no coincide con el rol';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `roles`
--

DROP TABLE IF EXISTS `roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `es_sistema` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_roles_empresa_nombre` (`empresa_id`,`nombre`),
  UNIQUE KEY `uq_roles_id_empresa` (`id`,`empresa_id`),
  KEY `idx_roles_empresa_activo` (`empresa_id`,`activo`),
  CONSTRAINT `fk_roles_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_roles_empresa_bu
BEFORE UPDATE ON roles
FOR EACH ROW
BEGIN
  DECLARE v_mismatch INT DEFAULT 0;
  IF NEW.empresa_id <> OLD.empresa_id THEN
    SELECT
      (SELECT COUNT(*)
       FROM user_roles ur
       INNER JOIN users u ON u.id = ur.user_id
       WHERE ur.role_id = OLD.id AND u.empresa_id <> NEW.empresa_id)
      +
      (SELECT COUNT(*)
       FROM rol_permisos rp
       WHERE rp.rol_id = OLD.id AND rp.empresa_id <> NEW.empresa_id)
      INTO v_mismatch;
    IF v_mismatch > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'roles: el cambio dejaría asignaciones de otra empresa';
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `sticker_lotes`
--

DROP TABLE IF EXISTS `sticker_lotes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sticker_lotes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `codigo_lote` varchar(80) NOT NULL,
  `tipo_generacion` varchar(30) NOT NULL,
  `estructura` varchar(255) DEFAULT NULL,
  `prefijo` varchar(80) DEFAULT NULL,
  `cantidad` int(11) NOT NULL DEFAULT 0,
  `numero_inicial` int(11) DEFAULT 1,
  `digitos` int(11) DEFAULT 4,
  `dias_garantia` int(11) DEFAULT 0,
  `tipo_garantia` varchar(80) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `creado_por` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sticker_lotes_empresa_codigo` (`empresa_id`,`codigo_lote`),
  KEY `idx_sticker_lotes_empresa_id` (`empresa_id`),
  CONSTRAINT `fk_sticker_lotes_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `stickers_garantia`
--

DROP TABLE IF EXISTS `stickers_garantia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `stickers_garantia` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `numero_sticker` varchar(20) NOT NULL,
  `estado` enum('DISPONIBLE','ASIGNADO','USADO','ANULADO') NOT NULL DEFAULT 'DISPONIBLE',
  `reparacion_id` varchar(50) DEFAULT NULL,
  `ubicacion_sticker` varchar(100) DEFAULT NULL,
  `fecha_asignacion` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `lote_id` int(11) DEFAULT NULL,
  `tipo_garantia` varchar(80) DEFAULT NULL,
  `dias_garantia` int(11) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_stickers_empresa_numero` (`empresa_id`,`numero_sticker`),
  KEY `idx_estado` (`estado`),
  KEY `idx_reparacion` (`reparacion_id`),
  KEY `idx_stickers_garantia_lote_id` (`lote_id`),
  KEY `idx_stickers_garantia_empresa_id` (`empresa_id`),
  KEY `idx_stickers_empresa_estado` (`empresa_id`,`estado`),
  KEY `idx_stickers_empresa_lote` (`empresa_id`,`lote_id`),
  CONSTRAINT `fk_stickers_garantia_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=1077 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `subcategorias`
--

DROP TABLE IF EXISTS `subcategorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `subcategorias` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `categoria_id` int(11) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `orden` int(11) DEFAULT 0,
  `activo` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `categoria_id` (`categoria_id`,`nombre`),
  UNIQUE KEY `uniq_subcategorias_empresa_categoria_nombre` (`empresa_id`,`categoria_id`,`nombre`),
  KEY `idx_subcategorias_empresa` (`empresa_id`),
  CONSTRAINT `subcategorias_ibfk_1` FOREIGN KEY (`categoria_id`) REFERENCES `categorias` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=73 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `sucursales`
--

DROP TABLE IF EXISTS `sucursales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `sucursales` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `codigo` varchar(50) NOT NULL,
  `nombre` varchar(150) NOT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `email` varchar(150) DEFAULT NULL,
  `activa` tinyint(1) NOT NULL DEFAULT 1,
  `es_principal` tinyint(1) NOT NULL DEFAULT 0,
  `principal_unica` tinyint(4) GENERATED ALWAYS AS (case when `es_principal` = 1 then 1 else NULL end) STORED,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sucursales_empresa_codigo` (`empresa_id`,`codigo`),
  UNIQUE KEY `uk_sucursales_empresa_id` (`empresa_id`,`id`),
  UNIQUE KEY `uk_sucursales_principal` (`empresa_id`,`principal_unica`),
  KEY `idx_sucursales_empresa_estado` (`empresa_id`,`activa`),
  CONSTRAINT `fk_sucursales_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `chk_sucursales_activa` CHECK (`activa` in (0,1)),
  CONSTRAINT `chk_sucursales_principal` CHECK (`es_principal` in (0,1))
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `suscripciones`
--

DROP TABLE IF EXISTS `suscripciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `suscripciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `plan` varchar(50) NOT NULL,
  `plan_id` bigint(20) unsigned NOT NULL,
  `plan_programado_id` bigint(20) unsigned DEFAULT NULL,
  `cambio_plan_efectivo_en` date DEFAULT NULL,
  `tipo` varchar(20) NOT NULL,
  `estado` varchar(20) NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_vencimiento` date DEFAULT NULL,
  `dias_gracia` int(11) NOT NULL DEFAULT 0,
  `fecha_fin_gracia` date DEFAULT NULL,
  `duracion_meses` int(11) DEFAULT NULL,
  `proxima_a_vencer_dias` int(11) NOT NULL DEFAULT 7,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_suscripciones_empresa` (`empresa_id`),
  KEY `idx_suscripciones_estado` (`estado`),
  KEY `idx_suscripciones_vencimiento` (`fecha_vencimiento`),
  KEY `idx_suscripciones_fin_gracia` (`fecha_fin_gracia`),
  KEY `idx_suscripciones_plan_id` (`plan_id`),
  KEY `idx_suscripciones_plan_programado` (`plan_programado_id`,`cambio_plan_efectivo_en`),
  CONSTRAINT `fk_suscripciones_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_suscripciones_plan` FOREIGN KEY (`plan_id`) REFERENCES `planes` (`id`),
  CONSTRAINT `fk_suscripciones_plan_programado` FOREIGN KEY (`plan_programado_id`) REFERENCES `planes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `chk_suscripciones_tipo` CHECK (`tipo` in ('prueba','comercial')),
  CONSTRAINT `chk_suscripciones_estado` CHECK (`estado` in ('prueba','vigente','gracia','vencida')),
  CONSTRAINT `chk_suscripciones_dias_gracia` CHECK (`dias_gracia` >= 0),
  CONSTRAINT `chk_suscripciones_proxima` CHECK (`proxima_a_vencer_dias` >= 0),
  CONSTRAINT `chk_suscripciones_duracion` CHECK (`duracion_meses` is null or `duracion_meses` in (1,3,6,12))
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tarjeta_credito_movimientos`
--

DROP TABLE IF EXISTS `tarjeta_credito_movimientos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tarjeta_credito_movimientos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `tarjeta_id` int(11) NOT NULL,
  `tipo` enum('compra','pago','interes','ajuste','anulacion') NOT NULL,
  `monto` int(11) NOT NULL DEFAULT 0,
  `descripcion` varchar(255) DEFAULT NULL,
  `referencia_tipo` varchar(50) DEFAULT NULL,
  `referencia_id` int(11) DEFAULT NULL,
  `cuenta_origen_id` int(11) DEFAULT NULL,
  `fecha_movimiento` datetime DEFAULT current_timestamp(),
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `tarjeta_id` (`tarjeta_id`),
  KEY `idx_tarjeta_credito_movimientos_empresa_id` (`empresa_id`),
  KEY `idx_tarjeta_credito_movimientos_empresa_tarjeta` (`empresa_id`,`tarjeta_id`),
  CONSTRAINT `fk_tarjeta_credito_movimientos_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `tarjeta_credito_movimientos_ibfk_1` FOREIGN KEY (`tarjeta_id`) REFERENCES `tarjetas_credito` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `tarjetas_credito`
--

DROP TABLE IF EXISTS `tarjetas_credito`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `tarjetas_credito` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `banco` varchar(100) NOT NULL,
  `alias` varchar(100) DEFAULT NULL,
  `ultimos4` char(4) NOT NULL,
  `tasa_interes` decimal(5,2) NOT NULL DEFAULT 0.00,
  `dia_corte` tinyint(4) NOT NULL,
  `dia_pago` tinyint(4) NOT NULL,
  `limite_credito` int(11) NOT NULL DEFAULT 0,
  `moneda` varchar(10) NOT NULL DEFAULT 'GTQ',
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `notas` text DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_tarjetas_credito_empresa_id` (`empresa_id`),
  KEY `idx_tarjetas_credito_empresa_activo` (`empresa_id`,`activo`),
  CONSTRAINT `fk_tarjetas_credito_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_profiles`
--

DROP TABLE IF EXISTS `user_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `nombres` varchar(100) NOT NULL DEFAULT 'Usuario',
  `apellidos` varchar(100) DEFAULT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `dpi` varchar(30) DEFAULT NULL,
  `direccion` varchar(255) DEFAULT NULL,
  `foto_perfil` varchar(255) DEFAULT NULL,
  `firma` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `fk_user_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=41 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `user_roles`
--

DROP TABLE IF EXISTS `user_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `role_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_role` (`user_id`,`role_id`),
  KEY `fk_user_roles_role` (`role_id`),
  CONSTRAINT `fk_user_roles_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_roles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=34 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_user_roles_empresa_bi
BEFORE INSERT ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_user_empresa INT;
  DECLARE v_role_empresa INT;
  DECLARE v_is_platform INT DEFAULT 0;
  SELECT empresa_id, (tipo_usuario = 'PLATAFORMA' OR COALESCE(es_super_admin, 0) = 1)
    INTO v_user_empresa, v_is_platform
  FROM users WHERE id = NEW.user_id;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.role_id;
  IF v_user_empresa IS NULL OR v_is_platform = 1 OR v_user_empresa <> v_role_empresa THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'user_roles: usuario y rol deben pertenecer a la misma empresa';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_user_roles_empresa_bu
BEFORE UPDATE ON user_roles
FOR EACH ROW
BEGIN
  DECLARE v_user_empresa INT;
  DECLARE v_role_empresa INT;
  DECLARE v_is_platform INT DEFAULT 0;
  SELECT empresa_id, (tipo_usuario = 'PLATAFORMA' OR COALESCE(es_super_admin, 0) = 1)
    INTO v_user_empresa, v_is_platform
  FROM users WHERE id = NEW.user_id;
  SELECT empresa_id INTO v_role_empresa FROM roles WHERE id = NEW.role_id;
  IF v_user_empresa IS NULL OR v_is_platform = 1 OR v_user_empresa <> v_role_empresa THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'user_roles: usuario y rol deben pertenecer a la misma empresa';
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `telefono` varchar(15) DEFAULT NULL,
  `foto_url` varchar(500) DEFAULT NULL,
  `role` enum('admin','employee','tecnico','superadmin') NOT NULL DEFAULT 'employee',
  `tipo_usuario` enum('EMPRESA','PLATAFORMA') NOT NULL DEFAULT 'EMPRESA',
  `es_super_admin` tinyint(1) NOT NULL DEFAULT 0,
  `empresa_id` int(11) DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `ultimo_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `uk_users_id_empresa` (`id`,`empresa_id`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_users_empresa_id` (`empresa_id`),
  KEY `idx_users_tipo_super_admin` (`tipo_usuario`,`es_super_admin`,`active`),
  CONSTRAINT `chk_users_scope` CHECK (`tipo_usuario` = 'EMPRESA' and `es_super_admin` = 0 and `empresa_id` is not null and `role` <> 'superadmin' or `tipo_usuario` = 'PLATAFORMA' and `es_super_admin` = 1 and `empresa_id` is null and `role` = 'superadmin')
) ENGINE=InnoDB AUTO_INCREMENT=29 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb3 */ ;
/*!50003 SET character_set_results = utf8mb3 */ ;
/*!50003 SET collation_connection  = utf8mb3_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER trg_users_roles_empresa_bu
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
  DECLARE v_mismatch INT DEFAULT 0;
  IF NOT (NEW.empresa_id <=> OLD.empresa_id)
     OR NEW.tipo_usuario <> OLD.tipo_usuario
     OR COALESCE(NEW.es_super_admin, 0) <> COALESCE(OLD.es_super_admin, 0) THEN
    SELECT COUNT(*) INTO v_mismatch
    FROM user_roles ur
    INNER JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = OLD.id
      AND (
        NEW.empresa_id IS NULL
        OR NEW.tipo_usuario = 'PLATAFORMA'
        OR COALESCE(NEW.es_super_admin, 0) = 1
        OR r.empresa_id <> NEW.empresa_id
      );
    IF v_mismatch > 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'users: el cambio dejaría roles de otra empresa';
    END IF;
  END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `usuario_sucursales`
--

DROP TABLE IF EXISTS `usuario_sucursales`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario_sucursales` (
  `usuario_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `empresa_id` int(11) NOT NULL,
  `es_predeterminada` tinyint(1) NOT NULL DEFAULT 0,
  `predeterminada_unica` tinyint(4) GENERATED ALWAYS AS (case when `es_predeterminada` = 1 then 1 else NULL end) STORED,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`usuario_id`,`sucursal_id`),
  UNIQUE KEY `uk_usuario_sucursal_predeterminada` (`usuario_id`,`predeterminada_unica`),
  KEY `idx_usuario_sucursales_empresa` (`empresa_id`,`usuario_id`),
  KEY `idx_usuario_sucursales_sucursal` (`empresa_id`,`sucursal_id`),
  KEY `fk_usuario_sucursales_usuario` (`usuario_id`,`empresa_id`),
  CONSTRAINT `fk_usuario_sucursales_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_usuario_sucursales_sucursal_empresa` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`) ON DELETE CASCADE,
  CONSTRAINT `fk_usuario_sucursales_usuario` FOREIGN KEY (`usuario_id`, `empresa_id`) REFERENCES `users` (`id`, `empresa_id`) ON DELETE CASCADE,
  CONSTRAINT `chk_usuario_sucursal_predeterminada` CHECK (`es_predeterminada` in (0,1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Temporary table structure for view `v_estadisticas_repuestos`
--

DROP TABLE IF EXISTS `v_estadisticas_repuestos`;
/*!50001 DROP VIEW IF EXISTS `v_estadisticas_repuestos`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_estadisticas_repuestos` AS SELECT
 1 AS `tipo`,
  1 AS `marca`,
  1 AS `total_items`,
  1 AS `stock_total`,
  1 AS `items_stock_bajo`,
  1 AS `valor_inventario_costo`,
  1 AS `valor_inventario_publico`,
  1 AS `precio_promedio` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_estadisticas_ventas`
--

DROP TABLE IF EXISTS `v_estadisticas_ventas`;
/*!50001 DROP VIEW IF EXISTS `v_estadisticas_ventas`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_estadisticas_ventas` AS SELECT
 1 AS `total_ventas`,
  1 AS `ventas_pagadas`,
  1 AS `ventas_pendientes`,
  1 AS `ventas_parciales`,
  1 AS `total_vendido_quetzales`,
  1 AS `total_cobrado_quetzales`,
  1 AS `total_pendiente_quetzales`,
  1 AS `promedio_venta_quetzales`,
  1 AS `ventas_hoy`,
  1 AS `total_hoy_quetzales`,
  1 AS `ventas_mes_actual`,
  1 AS `total_mes_actual_quetzales` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_lineas_con_marca`
--

DROP TABLE IF EXISTS `v_lineas_con_marca`;
/*!50001 DROP VIEW IF EXISTS `v_lineas_con_marca`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_lineas_con_marca` AS SELECT
 1 AS `id`,
  1 AS `linea_nombre`,
  1 AS `marca_id`,
  1 AS `marca_nombre`,
  1 AS `descripcion`,
  1 AS `activo`,
  1 AS `created_at`,
  1 AS `updated_at` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_marcas_con_lineas`
--

DROP TABLE IF EXISTS `v_marcas_con_lineas`;
/*!50001 DROP VIEW IF EXISTS `v_marcas_con_lineas`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_marcas_con_lineas` AS SELECT
 1 AS `marca_id`,
  1 AS `marca_nombre`,
  1 AS `marca_descripcion`,
  1 AS `marca_activo`,
  1 AS `total_lineas`,
  1 AS `lineas` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_repuestos_stock_bajo`
--

DROP TABLE IF EXISTS `v_repuestos_stock_bajo`;
/*!50001 DROP VIEW IF EXISTS `v_repuestos_stock_bajo`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_repuestos_stock_bajo` AS SELECT
 1 AS `id`,
  1 AS `nombre`,
  1 AS `tipo`,
  1 AS `marca`,
  1 AS `linea`,
  1 AS `stock`,
  1 AS `stock_minimo`,
  1 AS `unidades_faltantes`,
  1 AS `precio_publico`,
  1 AS `precio_costo`,
  1 AS `costo_reposicion_estimado` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_resumen_clientes`
--

DROP TABLE IF EXISTS `v_resumen_clientes`;
/*!50001 DROP VIEW IF EXISTS `v_resumen_clientes`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_resumen_clientes` AS SELECT
 1 AS `cliente_id`,
  1 AS `nombre`,
  1 AS `apellido`,
  1 AS `total_interacciones`,
  1 AS `total_cotizaciones`,
  1 AS `total_ventas`,
  1 AS `total_reparaciones`,
  1 AS `total_visitas`,
  1 AS `total_gastado`,
  1 AS `ultima_interaccion` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_resumen_cotizaciones`
--

DROP TABLE IF EXISTS `v_resumen_cotizaciones`;
/*!50001 DROP VIEW IF EXISTS `v_resumen_cotizaciones`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_resumen_cotizaciones` AS SELECT
 1 AS `cliente_id`,
  1 AS `nombre`,
  1 AS `apellido`,
  1 AS `total_cotizaciones`,
  1 AS `cotizaciones_enviadas`,
  1 AS `cotizaciones_aprobadas`,
  1 AS `cotizaciones_rechazadas`,
  1 AS `cotizaciones_vencidas`,
  1 AS `cotizaciones_convertidas`,
  1 AS `total_cotizado`,
  1 AS `total_convertido`,
  1 AS `ultima_cotizacion`,
  1 AS `tasa_conversion` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_ventas_completas`
--

DROP TABLE IF EXISTS `v_ventas_completas`;
/*!50001 DROP VIEW IF EXISTS `v_ventas_completas`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8mb4;
/*!50001 CREATE VIEW `v_ventas_completas` AS SELECT
 1 AS `id`,
  1 AS `numero_venta`,
  1 AS `cliente_id`,
  1 AS `cliente_nombre`,
  1 AS `cliente_telefono`,
  1 AS `cliente_nit`,
  1 AS `cotizacion_id`,
  1 AS `numero_cotizacion`,
  1 AS `tipo_venta`,
  1 AS `items`,
  1 AS `subtotal_quetzales`,
  1 AS `impuestos_quetzales`,
  1 AS `descuento_quetzales`,
  1 AS `total_quetzales`,
  1 AS `estado`,
  1 AS `metodo_pago`,
  1 AS `pagos`,
  1 AS `monto_pagado_quetzales`,
  1 AS `saldo_pendiente_quetzales`,
  1 AS `observaciones`,
  1 AS `factura_numero`,
  1 AS `factura_uuid`,
  1 AS `fecha_venta`,
  1 AS `created_at`,
  1 AS `updated_at`,
  1 AS `cliente_nombre_actual`,
  1 AS `cliente_telefono_actual`,
  1 AS `cotizacion_numero_actual`,
  1 AS `cotizacion_estado` */;
SET character_set_client = @saved_cs_client;

--
-- Table structure for table `venta_inventario_aplicaciones`
--

DROP TABLE IF EXISTS `venta_inventario_aplicaciones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `venta_inventario_aplicaciones` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `venta_id` int(11) NOT NULL,
  `linea` int(11) NOT NULL,
  `tipo_item` enum('PRODUCTO','REPUESTO') NOT NULL,
  `referencia_id` int(11) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `accion` enum('APLICACION','REVERSA') NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_venta_inventario_accion` (`empresa_id`,`sucursal_id`,`venta_id`,`linea`,`accion`),
  KEY `idx_venta_inventario_venta` (`empresa_id`,`sucursal_id`,`venta_id`),
  KEY `fk_venta_inventario_venta` (`venta_id`),
  CONSTRAINT `fk_venta_inventario_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `fk_venta_inventario_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`),
  CONSTRAINT `chk_venta_inventario_cantidad` CHECK (`cantidad` > 0)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `venta_movimientos_financieros`
--

DROP TABLE IF EXISTS `venta_movimientos_financieros`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `venta_movimientos_financieros` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `venta_id` int(11) NOT NULL,
  `pago_indice` int(11) NOT NULL,
  `accion` enum('INGRESO','REVERSA') NOT NULL,
  `metodo` varchar(30) NOT NULL,
  `monto_centavos` bigint(20) NOT NULL,
  `caja_id` bigint(20) unsigned DEFAULT NULL,
  `caja_sesion_id` bigint(20) unsigned DEFAULT NULL,
  `referencia` varchar(150) DEFAULT NULL,
  `usuario_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_venta_movimiento_financiero` (`empresa_id`,`sucursal_id`,`venta_id`,`pago_indice`,`accion`),
  KEY `idx_venta_movimiento_financiero_scope` (`empresa_id`,`sucursal_id`,`venta_id`,`accion`),
  KEY `fk_venta_movimiento_financiero_venta` (`venta_id`),
  KEY `fk_venta_movimiento_financiero_caja` (`caja_id`),
  KEY `fk_venta_movimiento_financiero_usuario` (`usuario_id`),
  KEY `idx_venta_fin_caja_sesion` (`empresa_id`,`sucursal_id`,`caja_id`,`caja_sesion_id`),
  CONSTRAINT `fk_venta_fin_caja_sesion` FOREIGN KEY (`empresa_id`, `sucursal_id`, `caja_id`, `caja_sesion_id`) REFERENCES `caja_sesiones` (`empresa_id`, `sucursal_id`, `caja_id`, `id`),
  CONSTRAINT `fk_venta_movimiento_financiero_caja` FOREIGN KEY (`caja_id`) REFERENCES `cajas` (`id`),
  CONSTRAINT `fk_venta_movimiento_financiero_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `fk_venta_movimiento_financiero_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_venta_movimiento_financiero_venta` FOREIGN KEY (`venta_id`) REFERENCES `ventas` (`id`),
  CONSTRAINT `chk_venta_movimiento_financiero_monto` CHECK (`monto_centavos` > 0),
  CONSTRAINT `chk_venta_movimiento_financiero_caja` CHECK (`metodo` = 'EFECTIVO' and `caja_id` is not null or `metodo` <> 'EFECTIVO' and `caja_id` is null)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ventas`
--

DROP TABLE IF EXISTS `ventas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ventas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `empresa_id` int(11) NOT NULL,
  `sucursal_id` bigint(20) unsigned NOT NULL,
  `numero_venta` varchar(20) NOT NULL COMMENT 'N├║mero ├║nico de venta (ej: V-2025-0001)',
  `cliente_id` int(11) NOT NULL,
  `cliente_nombre` varchar(200) NOT NULL,
  `cliente_telefono` varchar(15) DEFAULT NULL,
  `cliente_email` varchar(100) DEFAULT NULL,
  `cliente_nit` varchar(20) DEFAULT NULL,
  `cliente_direccion` text DEFAULT NULL,
  `cotizacion_id` int(11) DEFAULT NULL COMMENT 'ID de la cotizaci├│n origen (si aplica)',
  `numero_cotizacion` varchar(20) DEFAULT NULL COMMENT 'N├║mero de cotizaci├│n (desnormalizado)',
  `tipo_venta` enum('PRODUCTOS','REPUESTOS','MIXTA') NOT NULL DEFAULT 'PRODUCTOS',
  `items` longtext NOT NULL COMMENT 'Array: [{id, source, refId, nombre, cantidad, precioUnit, subtotal, notas}]' CHECK (json_valid(`items`)),
  `subtotal` int(11) NOT NULL DEFAULT 0 COMMENT 'Subtotal en centavos',
  `impuestos` int(11) NOT NULL DEFAULT 0 COMMENT 'IVA en centavos',
  `descuento` int(11) NOT NULL DEFAULT 0 COMMENT 'Descuento en centavos',
  `interes_tarjeta` int(11) DEFAULT 0 COMMENT 'InterÚs/recargo de POS en centavos',
  `total` int(11) NOT NULL DEFAULT 0 COMMENT 'Total en centavos',
  `estado` enum('PENDIENTE','PAGADA','PARCIAL','ANULADA') NOT NULL DEFAULT 'PENDIENTE',
  `metodo_pago` enum('EFECTIVO','TARJETA','TARJETA_BAC','TARJETA_NEONET','TARJETA_OTRA','TRANSFERENCIA','MIXTO') DEFAULT NULL,
  `pagos` longtext DEFAULT NULL COMMENT 'Array de pagos: [{metodo, monto, referencia, fecha, comprobanteUrl}]' CHECK (json_valid(`pagos`)),
  `monto_pagado` int(11) NOT NULL DEFAULT 0 COMMENT 'Total pagado en centavos',
  `saldo_pendiente` int(11) NOT NULL DEFAULT 0 COMMENT 'Saldo pendiente en centavos',
  `observaciones` text DEFAULT NULL,
  `notas_internas` text DEFAULT NULL,
  `factura_fel_id` varchar(50) DEFAULT NULL COMMENT 'ID de la factura FEL si fue facturada',
  `factura_numero` varchar(50) DEFAULT NULL COMMENT 'N├║mero de factura FEL',
  `factura_serie` varchar(20) DEFAULT NULL,
  `factura_uuid` varchar(100) DEFAULT NULL COMMENT 'UUID de la factura FEL',
  `fecha_facturacion` datetime DEFAULT NULL,
  `fecha_venta` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_by` int(11) DEFAULT NULL COMMENT 'ID del usuario que cre├│ la venta',
  `updated_by` int(11) DEFAULT NULL COMMENT 'ID del usuario que modific├│ la venta',
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_venta` (`numero_venta`),
  UNIQUE KEY `uk_ventas_empresa_sucursal_id` (`empresa_id`,`sucursal_id`,`id`),
  KEY `idx_cliente` (`cliente_id`),
  KEY `idx_cotizacion` (`cotizacion_id`),
  KEY `idx_estado` (`estado`),
  KEY `idx_fecha_venta` (`fecha_venta`),
  KEY `idx_numero` (`numero_venta`),
  KEY `idx_tipo_venta` (`tipo_venta`),
  KEY `idx_ventas_empresa_id` (`empresa_id`),
  KEY `idx_ventas_empresa_cliente` (`empresa_id`,`cliente_id`),
  KEY `idx_ventas_empresa_estado` (`empresa_id`,`estado`),
  KEY `idx_ventas_empresa_fecha` (`empresa_id`,`fecha_venta`),
  KEY `idx_ventas_scope_fecha` (`empresa_id`,`sucursal_id`,`fecha_venta`,`id`),
  CONSTRAINT `fk_ventas_empresa` FOREIGN KEY (`empresa_id`) REFERENCES `empresas` (`id`),
  CONSTRAINT `fk_ventas_sucursal` FOREIGN KEY (`empresa_id`, `sucursal_id`) REFERENCES `sucursales` (`empresa_id`, `id`),
  CONSTRAINT `ventas_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON UPDATE CASCADE,
  CONSTRAINT `ventas_ibfk_2` FOREIGN KEY (`cotizacion_id`) REFERENCES `cotizaciones` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=49 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `before_insert_ventas` BEFORE INSERT ON `ventas` FOR EACH ROW BEGIN
    DECLARE next_num INT;
    DECLARE year_suffix VARCHAR(4);
    
    
    SET year_suffix = YEAR(CURDATE());
    
    
    
    SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(numero_venta, '-', -1) AS UNSIGNED)), 0) + 1
    INTO next_num
    FROM ventas
    WHERE numero_venta COLLATE utf8mb4_unicode_ci LIKE CONCAT('V-', year_suffix, '-%') COLLATE utf8mb4_unicode_ci;
    
    
    SET NEW.numero_venta = CONCAT('V-', year_suffix, '-', LPAD(next_num, 4, '0'));
    
    
    SET NEW.saldo_pendiente = NEW.total - NEW.monto_pagado;
    
    
    IF NEW.monto_pagado >= NEW.total THEN
        SET NEW.estado = 'PAGADA';
    ELSEIF NEW.monto_pagado > 0 THEN
        SET NEW.estado = 'PARCIAL';
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `after_insert_ventas_from_quote` AFTER INSERT ON `ventas` FOR EACH ROW BEGIN
    
    IF NEW.cotizacion_id IS NOT NULL THEN
        UPDATE cotizaciones
        SET estado = 'CONVERTIDA',
            convertida = 1,
            convertida_a = 'VENTA',
            referencia_venta_id = NEW.id,
            fecha_conversion = NOW()
        WHERE id = NEW.cotizacion_id;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `before_update_ventas` BEFORE UPDATE ON `ventas` FOR EACH ROW BEGIN
    
    SET NEW.saldo_pendiente = NEW.total - NEW.monto_pagado;
    
    
    IF NEW.estado != 'ANULADA' THEN
        IF NEW.monto_pagado >= NEW.total THEN
            SET NEW.estado = 'PAGADA';
        ELSEIF NEW.monto_pagado > 0 THEN
            SET NEW.estado = 'PARCIAL';
        ELSE
            SET NEW.estado = 'PENDIENTE';
        END IF;
    END IF;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Dumping events for database 'tecnoone_demo'
--

--
-- Dumping routines for database 'tecnoone_demo'
--
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_anular_venta` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_anular_venta`(IN `p_venta_id` INT, IN `p_motivo` TEXT, IN `p_usuario_id` INT)
BEGIN
    DECLARE v_cotizacion_id INT;
    
    
    SELECT cotizacion_id INTO v_cotizacion_id
    FROM ventas WHERE id = p_venta_id;
    
    
    UPDATE ventas
    SET estado = 'ANULADA',
        notas_internas = CONCAT(COALESCE(notas_internas, ''), '\nANULADA: ', p_motivo, ' - ', NOW()),
        updated_by = p_usuario_id
    WHERE id = p_venta_id;
    
    
    IF v_cotizacion_id IS NOT NULL THEN
        UPDATE cotizaciones
        SET estado = 'ENVIADA',
            convertida_a = NULL,
            referencia_venta_id = NULL,
            fecha_conversion = NULL
        WHERE id = v_cotizacion_id;
    END IF;
    
    SELECT 'Venta anulada exitosamente' as mensaje;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_cotizaciones_proximas_vencer` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_cotizaciones_proximas_vencer`(IN `dias_anticipacion` INT)
BEGIN
    SELECT 
        cot.id,
        cot.numero_cotizacion,
        cot.cliente_nombre,
        cot.cliente_telefono,
        cot.fecha_emision,
        cot.fecha_vencimiento,
        DATEDIFF(cot.fecha_vencimiento, CURDATE()) AS dias_restantes,
        cot.total,
        cot.estado
    FROM cotizaciones cot
    WHERE cot.estado IN ('ENVIADA', 'BORRADOR')
        AND cot.fecha_vencimiento BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL dias_anticipacion DAY)
    ORDER BY cot.fecha_vencimiento ASC;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_registrar_movimiento_repuesto` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_registrar_movimiento_repuesto`(IN `p_repuesto_id` INT, IN `p_tipo_movimiento` VARCHAR(20), IN `p_cantidad` INT, IN `p_precio_unitario` INT, IN `p_referencia_tipo` VARCHAR(20), IN `p_referencia_id` INT, IN `p_usuario_id` INT, IN `p_notas` TEXT)
BEGIN
  DECLARE v_stock_actual INT;
  DECLARE v_stock_nuevo INT;
  
  
  SELECT stock INTO v_stock_actual FROM repuestos WHERE id = p_repuesto_id;
  
  
  IF p_tipo_movimiento IN ('ENTRADA', 'DEVOLUCION') THEN
    SET v_stock_nuevo = v_stock_actual + p_cantidad;
  ELSEIF p_tipo_movimiento IN ('SALIDA', 'VENTA', 'REPARACION') THEN
    SET v_stock_nuevo = v_stock_actual - p_cantidad;
  ELSE  
    SET v_stock_nuevo = p_cantidad;
  END IF;
  
  
  IF v_stock_nuevo < 0 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Stock insuficiente para realizar el movimiento';
  END IF;
  
  
  INSERT INTO repuestos_movimientos (
    repuesto_id, tipo_movimiento, cantidad, 
    stock_anterior, stock_nuevo, precio_unitario,
    referencia_tipo, referencia_id, usuario_id, notas
  ) VALUES (
    p_repuesto_id, p_tipo_movimiento, p_cantidad,
    v_stock_actual, v_stock_nuevo, p_precio_unitario,
    p_referencia_tipo, p_referencia_id, p_usuario_id, p_notas
  );
  
  
  UPDATE repuestos SET stock = v_stock_nuevo WHERE id = p_repuesto_id;
  
  SELECT 'Movimiento registrado exitosamente' AS mensaje, v_stock_nuevo AS nuevo_stock;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'NO_AUTO_VALUE_ON_ZERO' */ ;
/*!50003 DROP PROCEDURE IF EXISTS `sp_registrar_pago_venta` */;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_general_ci */ ;
DELIMITER ;;
CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_registrar_pago_venta`(IN `p_venta_id` INT, IN `p_monto` INT, IN `p_metodo` VARCHAR(20), IN `p_referencia` VARCHAR(100), IN `p_comprobante_url` TEXT, IN `p_usuario_id` INT)
BEGIN
    DECLARE current_pagos JSON;
    DECLARE new_pago JSON;
    DECLARE nuevo_monto_pagado INT;
    
    
    SELECT pagos, monto_pagado INTO current_pagos, nuevo_monto_pagado
    FROM ventas WHERE id = p_venta_id;
    
    
    SET new_pago = JSON_OBJECT(
        'metodo', p_metodo,
        'monto', p_monto,
        'referencia', p_referencia,
        'comprobanteUrl', p_comprobante_url,
        'fecha', NOW(),
        'usuario_id', p_usuario_id
    );
    
    
    IF current_pagos IS NULL THEN
        SET current_pagos = JSON_ARRAY(new_pago);
    ELSE
        SET current_pagos = JSON_ARRAY_APPEND(current_pagos, '$', new_pago);
    END IF;
    
    
    SET nuevo_monto_pagado = nuevo_monto_pagado + p_monto;
    
    UPDATE ventas
    SET pagos = current_pagos,
        monto_pagado = nuevo_monto_pagado,
        metodo_pago = IF(JSON_LENGTH(current_pagos) > 1, 'MIXTO', p_metodo),
        updated_by = p_usuario_id
    WHERE id = p_venta_id;
    
    SELECT 'Pago registrado exitosamente' as mensaje;
END ;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Final view structure for view `v_estadisticas_repuestos`
--

/*!50001 DROP VIEW IF EXISTS `v_estadisticas_repuestos`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_estadisticas_repuestos` AS select `repuestos`.`tipo` AS `tipo`,`repuestos`.`marca` AS `marca`,count(0) AS `total_items`,sum(`repuestos`.`stock`) AS `stock_total`,sum(case when `repuestos`.`stock` < `repuestos`.`stock_minimo` then 1 else 0 end) AS `items_stock_bajo`,sum(`repuestos`.`precio_costo` * `repuestos`.`stock`) / 100 AS `valor_inventario_costo`,sum(`repuestos`.`precio_publico` * `repuestos`.`stock`) / 100 AS `valor_inventario_publico`,avg(`repuestos`.`precio_publico`) / 100 AS `precio_promedio` from `repuestos` where `repuestos`.`activo` = 1 group by `repuestos`.`tipo`,`repuestos`.`marca` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_estadisticas_ventas`
--

/*!50001 DROP VIEW IF EXISTS `v_estadisticas_ventas`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_estadisticas_ventas` AS select count(0) AS `total_ventas`,sum(case when `ventas`.`estado` = 'PAGADA' then 1 else 0 end) AS `ventas_pagadas`,sum(case when `ventas`.`estado` = 'PENDIENTE' then 1 else 0 end) AS `ventas_pendientes`,sum(case when `ventas`.`estado` = 'PARCIAL' then 1 else 0 end) AS `ventas_parciales`,sum(`ventas`.`total`) / 100 AS `total_vendido_quetzales`,sum(`ventas`.`monto_pagado`) / 100 AS `total_cobrado_quetzales`,sum(`ventas`.`saldo_pendiente`) / 100 AS `total_pendiente_quetzales`,avg(`ventas`.`total`) / 100 AS `promedio_venta_quetzales`,sum(case when cast(`ventas`.`fecha_venta` as date) = curdate() then 1 else 0 end) AS `ventas_hoy`,sum(case when cast(`ventas`.`fecha_venta` as date) = curdate() then `ventas`.`total` else 0 end) / 100 AS `total_hoy_quetzales`,sum(case when month(`ventas`.`fecha_venta`) = month(curdate()) and year(`ventas`.`fecha_venta`) = year(curdate()) then 1 else 0 end) AS `ventas_mes_actual`,sum(case when month(`ventas`.`fecha_venta`) = month(curdate()) and year(`ventas`.`fecha_venta`) = year(curdate()) then `ventas`.`total` else 0 end) / 100 AS `total_mes_actual_quetzales` from `ventas` where `ventas`.`estado` <> 'ANULADA' */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_lineas_con_marca`
--

/*!50001 DROP VIEW IF EXISTS `v_lineas_con_marca`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_lineas_con_marca` AS select `l`.`id` AS `id`,`l`.`nombre` AS `linea_nombre`,`l`.`marca_id` AS `marca_id`,`m`.`nombre` AS `marca_nombre`,`l`.`descripcion` AS `descripcion`,`l`.`activo` AS `activo`,`l`.`created_at` AS `created_at`,`l`.`updated_at` AS `updated_at` from (`lineas` `l` join `marcas` `m` on(`l`.`marca_id` = `m`.`id`)) where `l`.`activo` = 1 and `m`.`activo` = 1 order by `m`.`nombre`,`l`.`nombre` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_marcas_con_lineas`
--

/*!50001 DROP VIEW IF EXISTS `v_marcas_con_lineas`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_marcas_con_lineas` AS select `m`.`id` AS `marca_id`,`m`.`nombre` AS `marca_nombre`,`m`.`descripcion` AS `marca_descripcion`,`m`.`activo` AS `marca_activo`,count(`l`.`id`) AS `total_lineas`,group_concat(`l`.`nombre` order by `l`.`nombre` ASC separator ', ') AS `lineas` from (`marcas` `m` left join `lineas` `l` on(`m`.`id` = `l`.`marca_id` and `l`.`activo` = 1)) where `m`.`activo` = 1 group by `m`.`id`,`m`.`nombre`,`m`.`descripcion`,`m`.`activo` order by `m`.`nombre` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_repuestos_stock_bajo`
--

/*!50001 DROP VIEW IF EXISTS `v_repuestos_stock_bajo`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_repuestos_stock_bajo` AS select `r`.`id` AS `id`,`r`.`nombre` AS `nombre`,`r`.`tipo` AS `tipo`,`r`.`marca` AS `marca`,`r`.`linea` AS `linea`,`r`.`stock` AS `stock`,`r`.`stock_minimo` AS `stock_minimo`,`r`.`stock_minimo` - `r`.`stock` AS `unidades_faltantes`,`r`.`precio_publico` AS `precio_publico`,`r`.`precio_costo` AS `precio_costo`,`r`.`precio_costo` * (`r`.`stock_minimo` - `r`.`stock`) AS `costo_reposicion_estimado` from `repuestos` `r` where `r`.`activo` = 1 and `r`.`stock` < `r`.`stock_minimo` order by `r`.`stock_minimo` - `r`.`stock` desc */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_resumen_clientes`
--

/*!50001 DROP VIEW IF EXISTS `v_resumen_clientes`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_resumen_clientes` AS select `c`.`id` AS `cliente_id`,`c`.`nombre` AS `nombre`,`c`.`apellido` AS `apellido`,count(`i`.`id`) AS `total_interacciones`,sum(case when `i`.`tipo` = 'cotizacion' then 1 else 0 end) AS `total_cotizaciones`,sum(case when `i`.`tipo` = 'venta' then 1 else 0 end) AS `total_ventas`,sum(case when `i`.`tipo` = 'reparacion' then 1 else 0 end) AS `total_reparaciones`,sum(case when `i`.`tipo` = 'visita' then 1 else 0 end) AS `total_visitas`,coalesce(sum(case when `i`.`tipo` = 'venta' then `i`.`monto` else 0 end),0) AS `total_gastado`,max(`i`.`created_at`) AS `ultima_interaccion` from (`clientes` `c` left join `interacciones_clientes` `i` on(`c`.`id` = `i`.`cliente_id`)) where `c`.`activo` = 1 group by `c`.`id`,`c`.`nombre`,`c`.`apellido` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_resumen_cotizaciones`
--

/*!50001 DROP VIEW IF EXISTS `v_resumen_cotizaciones`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_resumen_cotizaciones` AS select `c`.`id` AS `cliente_id`,`c`.`nombre` AS `nombre`,`c`.`apellido` AS `apellido`,count(`cot`.`id`) AS `total_cotizaciones`,sum(case when `cot`.`estado` = 'ENVIADA' then 1 else 0 end) AS `cotizaciones_enviadas`,sum(case when `cot`.`estado` = 'APROBADA' then 1 else 0 end) AS `cotizaciones_aprobadas`,sum(case when `cot`.`estado` = 'RECHAZADA' then 1 else 0 end) AS `cotizaciones_rechazadas`,sum(case when `cot`.`estado` = 'VENCIDA' then 1 else 0 end) AS `cotizaciones_vencidas`,sum(case when `cot`.`estado` = 'CONVERTIDA' then 1 else 0 end) AS `cotizaciones_convertidas`,sum(`cot`.`total`) AS `total_cotizado`,sum(case when `cot`.`estado` = 'CONVERTIDA' then `cot`.`total` else 0 end) AS `total_convertido`,max(`cot`.`fecha_emision`) AS `ultima_cotizacion`,round(sum(case when `cot`.`estado` = 'CONVERTIDA' then `cot`.`total` else 0 end) / nullif(sum(`cot`.`total`),0) * 100,2) AS `tasa_conversion` from (`clientes` `c` left join `cotizaciones` `cot` on(`c`.`id` = `cot`.`cliente_id`)) where `c`.`activo` = 1 group by `c`.`id`,`c`.`nombre`,`c`.`apellido` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_ventas_completas`
--

/*!50001 DROP VIEW IF EXISTS `v_ventas_completas`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_ventas_completas` AS select `v`.`id` AS `id`,`v`.`numero_venta` AS `numero_venta`,`v`.`cliente_id` AS `cliente_id`,`v`.`cliente_nombre` AS `cliente_nombre`,`v`.`cliente_telefono` AS `cliente_telefono`,`v`.`cliente_nit` AS `cliente_nit`,`v`.`cotizacion_id` AS `cotizacion_id`,`v`.`numero_cotizacion` AS `numero_cotizacion`,`v`.`tipo_venta` AS `tipo_venta`,`v`.`items` AS `items`,`v`.`subtotal` / 100 AS `subtotal_quetzales`,`v`.`impuestos` / 100 AS `impuestos_quetzales`,`v`.`descuento` / 100 AS `descuento_quetzales`,`v`.`total` / 100 AS `total_quetzales`,`v`.`estado` AS `estado`,`v`.`metodo_pago` AS `metodo_pago`,`v`.`pagos` AS `pagos`,`v`.`monto_pagado` / 100 AS `monto_pagado_quetzales`,`v`.`saldo_pendiente` / 100 AS `saldo_pendiente_quetzales`,`v`.`observaciones` AS `observaciones`,`v`.`factura_numero` AS `factura_numero`,`v`.`factura_uuid` AS `factura_uuid`,`v`.`fecha_venta` AS `fecha_venta`,`v`.`created_at` AS `created_at`,`v`.`updated_at` AS `updated_at`,`c`.`nombre` AS `cliente_nombre_actual`,`c`.`telefono` AS `cliente_telefono_actual`,`cot`.`numero_cotizacion` AS `cotizacion_numero_actual`,`cot`.`estado` AS `cotizacion_estado` from ((`ventas` `v` left join `clientes` `c` on(`v`.`cliente_id` = `c`.`id`)) left join `cotizaciones` `cot` on(`v`.`cotizacion_id` = `cot`.`id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11  2:20:47

-- Datos globales: modulos
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.25-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tecnoone_demo
-- ------------------------------------------------------
-- Server version	10.6.25-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `modulos`
--

LOCK TABLES `modulos` WRITE;
/*!40000 ALTER TABLE `modulos` DISABLE KEYS */;
INSERT INTO `modulos` (`id`, `codigo`, `nombre`, `grupo`, `descripcion`, `activo`, `siempre_habilitado`, `created_at`, `updated_at`) VALUES (1,'dashboard','Dashboard','plataforma','Panel principal empresarial.',1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,'clientes','Clientes','comercial','Gestión de clientes.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,'productos','Productos','inventario','Catálogo de productos y categorías.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,'inventario','Inventario','inventario','Existencias, movimientos y repuestos.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,'ventas','Ventas','comercial','Punto de venta y ventas.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(6,'cotizaciones','Cotizaciones','comercial','Cotizaciones comerciales.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(7,'compras','Compras','comercial','Compras y entradas de inventario.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(8,'proveedores','Proveedores','comercial','Gestión de proveedores.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(9,'caja_bancos','Caja y bancos','finanzas','Caja, bancos y movimientos financieros.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(10,'tarjetas','Tarjetas','finanzas','Control de tarjetas de crédito.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(11,'deudores_pagos','Deudores y pagos','finanzas','Cuentas por cobrar y pagos.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(12,'reportes_comerciales','Reportes comerciales','comercial','Reportes de ventas, compras e inventario.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(13,'reparaciones','Reparaciones','taller','Recepción y seguimiento de reparaciones.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(14,'taller_operativo','Operación de taller','taller','Flujo técnico, equipos, agenda, contratos y checklist.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(15,'reportes_taller','Reportes de taller','taller','Métricas y reportes técnicos.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(16,'usuarios','Usuarios','plataforma','Gestión de usuarios empresariales.',1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(17,'roles_permisos','Roles y permisos','plataforma','Administración de acceso empresarial.',1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(18,'auditoria','Auditoría','plataforma','Historial de acciones empresariales.',1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(19,'configuracion','Configuración','plataforma','Configuración general de empresa.',1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(20,'multisucursal','Multisucursal','multisucursal','Gestión y consolidación por sucursal.',1,0,'2026-06-23 04:22:13','2026-06-23 04:22:13');
/*!40000 ALTER TABLE `modulos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11  2:20:47

-- Datos globales: permisos
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.25-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tecnoone_demo
-- ------------------------------------------------------
-- Server version	10.6.25-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `permisos`
--

LOCK TABLES `permisos` WRITE;
/*!40000 ALTER TABLE `permisos` DISABLE KEYS */;
INSERT INTO `permisos` (`id`, `codigo`, `modulo`, `accion`, `nombre`, `descripcion`, `created_at`) VALUES (1,'dashboard.ver','Dashboard','ver','Ver dashboard','Acceder al panel principal','2026-06-21 16:59:37'),(2,'productos.ver','Productos','ver','Ver productos','Consultar productos','2026-06-21 16:59:37'),(3,'repuestos.ver','Repuestos','ver','Ver repuestos','Consultar repuestos','2026-06-21 16:59:37'),(4,'compras.ver','Compras','ver','Ver compras','Consultar compras','2026-06-21 16:59:37'),(5,'compras.crear','Compras','crear','Crear compras','Registrar compras','2026-06-21 16:59:37'),(6,'compras.anular','Compras','anular','Anular compras','Anular compras registradas','2026-06-21 16:59:37'),(7,'cotizaciones.ver','Cotizaciones','ver','Ver cotizaciones','Consultar cotizaciones','2026-06-21 16:59:37'),(8,'cotizaciones.editar','Cotizaciones','editar','Gestionar cotizaciones','Crear y editar cotizaciones','2026-06-21 16:59:37'),(9,'ventas.ver','Ventas','ver','Ver ventas','Consultar ventas','2026-06-21 16:59:37'),(10,'ventas.crear','Ventas','crear','Crear ventas','Registrar ventas','2026-06-21 16:59:37'),(11,'ventas.editar','Ventas','editar','Gestionar pagos','Registrar pagos y comprobantes de ventas','2026-06-21 16:59:37'),(12,'ventas.anular','Ventas','anular','Anular ventas','Anular ventas registradas','2026-06-21 16:59:37'),(13,'reparaciones.ver','Reparaciones','ver','Ver reparaciones','Consultar reparaciones','2026-06-21 16:59:37'),(14,'reparaciones.crear','Reparaciones','crear','Crear reparaciones','Registrar reparaciones','2026-06-21 16:59:37'),(15,'reparaciones.editar','Reparaciones','editar','Editar reparaciones','Actualizar reparaciones, estados y pagos','2026-06-21 16:59:37'),(16,'reparaciones.asignar_tecnico','Reparaciones','asignar_tecnico','Asignar técnicos','Asignar o retirar técnicos','2026-06-21 16:59:37'),(17,'flujo_reparaciones.ver','Flujo de reparaciones','ver','Ver flujo de reparaciones','Consultar el flujo técnico','2026-06-21 16:59:37'),(18,'ordenes_trabajo.ver','Órdenes de trabajo','ver','Ver órdenes de trabajo','Consultar órdenes de trabajo','2026-06-21 16:59:37'),(19,'agenda.ver','Agenda','ver','Ver agenda','Consultar agenda de entregas','2026-06-21 16:59:37'),(20,'stickers.ver','Stickers','ver','Gestionar stickers','Acceder al módulo de stickers','2026-06-21 16:59:37'),(21,'clientes.ver','Clientes','ver','Ver clientes','Consultar clientes','2026-06-21 16:59:37'),(22,'clientes.crear','Clientes','crear','Gestionar clientes','Crear y editar clientes','2026-06-21 16:59:37'),(23,'proveedores.ver','Proveedores','ver','Gestionar proveedores','Acceder a proveedores','2026-06-21 16:59:37'),(24,'caja.ver','Caja y bancos','ver','Ver caja y bancos','Consultar caja y cuentas bancarias','2026-06-21 16:59:37'),(25,'caja.operar','Caja y bancos','operar','Operar caja','Registrar y confirmar movimientos','2026-06-21 16:59:37'),(26,'bancos.administrar','Caja y bancos','administrar','Administrar bancos','Gestionar cuentas y transferencias bancarias','2026-06-21 16:59:37'),(27,'deudores.ver','Deudores','ver','Ver deudores','Consultar deudores','2026-06-21 16:59:37'),(28,'reportes.ver','Reportes','ver','Ver reportes','Consultar reportes administrativos','2026-06-21 16:59:37'),(29,'usuarios.administrar','Usuarios','administrar','Administrar usuarios','Crear, editar y gestionar usuarios y roles','2026-06-21 16:59:37'),(30,'permisos.administrar','Permisos','administrar','Administrar permisos','Configurar permisos por rol','2026-06-21 16:59:37'),(31,'empresa.editar','Empresa','editar','Editar empresa','Modificar la configuración de la empresa','2026-06-21 16:59:37'),(32,'auditoria.ver','Auditoría','ver','Ver auditoría','Consultar registros de auditoría','2026-06-21 16:59:37'),(65,'productos.administrar','Productos','administrar','Administrar productos','Crear, editar, ajustar stock y desactivar productos','2026-06-24 04:11:55'),(66,'repuestos.administrar','Repuestos','administrar','Administrar repuestos','Crear, editar, eliminar y registrar movimientos de repuestos','2026-06-24 04:11:55'),(67,'flujo_reparaciones.editar','Flujo de reparaciones','editar','Gestionar flujo de reparaciones','Actualizar estados, técnicos, prioridades y reingresos por garantía','2026-06-24 04:11:55'),(68,'agenda.editar','Agenda','editar','Gestionar agenda','Crear, editar y eliminar eventos de agenda','2026-06-24 04:11:55'),(69,'stickers.administrar','Stickers','administrar','Administrar stickers','Crear lotes, asignar, anular y liberar stickers','2026-06-24 04:11:55'),(70,'proveedores.administrar','Proveedores','administrar','Administrar proveedores','Crear, editar y desactivar proveedores','2026-06-24 04:11:55'),(71,'deudores.administrar','Deudores','administrar','Administrar deudores','Crear deudas, registrar pagos y anular registros','2026-06-24 04:11:55'),(72,'tarjetas.ver','Tarjetas de crédito','ver','Ver tarjetas de crédito','Consultar tarjetas y movimientos','2026-06-24 04:11:55'),(73,'tarjetas.administrar','Tarjetas de crédito','administrar','Administrar tarjetas de crédito','Crear, editar, desactivar, pagar y ajustar tarjetas','2026-06-24 04:11:55'),(74,'catalogos.administrar','Catálogos','administrar','Administrar catálogos','Gestionar categorías, marcas, líneas y modelos','2026-06-24 04:11:55'),(85,'cajas.ver','Cajas','ver','Ver cajas','Consultar el catalogo de cajas de la sucursal activa','2026-07-19 00:09:08'),(86,'cajas.administrar','Cajas','administrar','Administrar cajas','Crear, editar, activar y desactivar cajas','2026-07-19 00:09:08'),(87,'sucursales.contexto_consolidado','Sucursales','contexto_consolidado','Consultar todas las sucursales asignadas','Permite usar el contexto consolidado de solo consulta sobre las sucursales asignadas al usuario','2026-07-23 05:46:08'),(88,'cajas.sesion.ver','Cajas','sesion_ver','Ver sesiones de caja','Consultar historial de sesiones de caja','2026-08-09 01:47:12'),(89,'cajas.sesion.operar','Cajas','sesion_operar','Operar sesiones de caja','Abrir y cerrar sesiones de caja','2026-08-09 01:47:12'),(90,'caja.arquear','Caja y bancos','arquear','Registrar arqueos de Caja Chica','Registrar conteos y diferencias de Caja Chica por sucursal','2026-08-10 02:46:02'),(91,'caja.reponer','Caja y bancos','reponer','Reponer Caja Chica desde banco','Trasladar fondos de una cuenta bancaria a Caja Chica','2026-08-10 02:46:02'),(92,'caja.reponer_manual','Caja y bancos','reponer_manual','Reponer Caja Chica manualmente','Registrar ingresos manuales autorizados a Caja Chica','2026-08-10 02:46:02'),(93,'ordenes_trabajo.ver_todas','Órdenes de trabajo','ver_todas','Ver todas las órdenes de trabajo','Consultar órdenes asignadas a cualquier técnico dentro de las sucursales permitidas','2026-08-10 04:31:54'),(94,'costos.ver','Productos','ver_costos','Ver costos','Consultar costos, inversión y margen de productos','2026-08-10 04:31:54'),(95,'dashboard.ver_financiero','Dashboard','ver_financiero','Ver dashboard financiero','Consultar indicadores financieros del dashboard','2026-08-10 04:31:54'),(96,'dashboard.ver_ventas','Dashboard','ver_ventas','Ver dashboard de ventas','Consultar indicadores comerciales del dashboard','2026-08-10 04:31:54'),(97,'dashboard.ver_tecnico','Dashboard','ver_tecnico','Ver dashboard técnico','Consultar indicadores técnicos propios del dashboard','2026-08-10 04:31:54');
/*!40000 ALTER TABLE `permisos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11  2:20:47

-- Datos globales: planes
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.25-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tecnoone_demo
-- ------------------------------------------------------
-- Server version	10.6.25-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `planes`
--

LOCK TABLES `planes` WRITE;
/*!40000 ALTER TABLE `planes` DISABLE KEYS */;
INSERT INTO `planes` (`id`, `codigo`, `nombre`, `descripcion`, `precio_mensual`, `precio_anual`, `moneda`, `max_usuarios`, `max_sucursales`, `activo`, `es_publico`, `asignable`, `orden`, `created_at`, `updated_at`) VALUES (1,'pos','TecnoOne POS','Ventas, inventario, compras, caja y administración comercial.',300.00,NULL,'GTQ',2,1,1,1,1,10,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,'taller','TecnoOne Taller','Gestión comercial completa y operación de talleres de reparación.',500.00,NULL,'GTQ',3,1,1,1,1,20,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,'multisucursal','TecnoOne Multisucursal','Plan reservado para futura infraestructura multisucursal.',800.00,NULL,'GTQ',9,3,1,0,0,30,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,'legacy_demo','Demo heredado','Compatibilidad para empresas demo creadas antes del catálogo de planes.',0.00,NULL,'GTQ',NULL,NULL,1,0,0,90,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,'legacy_full','Acceso completo heredado','Compatibilidad para empresas antiguas con acceso completo.',0.00,NULL,'GTQ',NULL,NULL,1,0,0,100,'2026-06-23 04:22:13','2026-06-23 04:22:13');
/*!40000 ALTER TABLE `planes` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11  2:20:47

-- Datos globales: plan_modulos
/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.6.25-MariaDB, for debian-linux-gnu (x86_64)
--
-- Host: localhost    Database: tecnoone_demo
-- ------------------------------------------------------
-- Server version	10.6.25-MariaDB-ubu2204

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `plan_modulos`
--

LOCK TABLES `plan_modulos` WRITE;
/*!40000 ALTER TABLE `plan_modulos` DISABLE KEYS */;
INSERT INTO `plan_modulos` (`plan_id`, `modulo_id`, `habilitado`, `created_at`, `updated_at`) VALUES (1,1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,2,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,3,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,4,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,5,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,6,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,7,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,8,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,9,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,10,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,11,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,12,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,16,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,17,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,18,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(1,19,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,2,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,3,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,4,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,5,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,6,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,7,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,8,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,9,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,10,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,11,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,12,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,13,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,14,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,15,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,16,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,17,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,18,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(2,19,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,2,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,3,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,4,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,5,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,6,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,7,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,8,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,9,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,10,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,11,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,12,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,13,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,14,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,15,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,16,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,17,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,18,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,19,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(3,20,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,2,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,3,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,4,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,5,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,6,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,7,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,8,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,9,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,10,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,11,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,12,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,13,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,14,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,15,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,16,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,17,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,18,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,19,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(4,20,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,1,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,2,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,3,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,4,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,5,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,6,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,7,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,8,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,9,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,10,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,11,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,12,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,13,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,14,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,15,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,16,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,17,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,18,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,19,1,'2026-06-23 04:22:13','2026-06-23 04:22:13'),(5,20,1,'2026-06-23 04:22:13','2026-06-23 04:22:13');
/*!40000 ALTER TABLE `plan_modulos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-08-11  2:20:48
