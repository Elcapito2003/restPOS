# Despliegue de RestPOS en PC del Punto de Venta

## Requisitos previos (instalar en la PC POS)

### 1. Node.js v20+
- Descargar de https://nodejs.org (LTS)
- Instalar con opciones por defecto
- Verificar: abrir CMD y escribir `node --version`

### 2. Docker Desktop (para PostgreSQL)
- Descargar de https://www.docker.com/products/docker-desktop/
- Instalar y reiniciar PC
- Verificar: abrir CMD y escribir `docker --version`

### 3. Git (opcional, para clonar)
- Descargar de https://git-scm.com

---

## Instalacion

### Paso 1: Copiar el proyecto
Copiar toda la carpeta `restPOS` a la PC POS (USB, red, o git clone).
Ejemplo: `C:\restPOS`

### Paso 2: Abrir terminal en la carpeta
```
cd C:\restPOS
```

### Paso 3: Levantar la base de datos
```
docker compose up -d
```
Esto crea PostgreSQL en el puerto 5432.

### Paso 4: Configurar el .env
Editar el archivo `.env` en la raiz:
```
DATABASE_URL=postgresql://restpos:restpos123@localhost:5432/restpos
JWT_SECRET=CAMBIAR-POR-UNA-CLAVE-SEGURA-AQUI
JWT_EXPIRES_IN=12h
PORT=3001
NODE_ENV=production
PRINTER_KITCHEN=
PRINTER_BAR=
PRINTER_CASHIER=
CLIENT_URL=http://localhost:3001
```

### Paso 5: Instalar dependencias
```
npm install
```

### Paso 6: Correr migraciones (crear tablas)
```
npm run db:migrate
```

### Paso 7: Sembrar datos iniciales (usuario admin)
```
npm run db:seed
```

### Paso 8: Construir el proyecto
```
npm run build
```

### Paso 9: Iniciar en produccion
```
npm start -w server
```

RestPOS estara disponible en `http://localhost:3001`

---

## Acceder desde otros dispositivos

Desde cualquier telefono/tablet/PC en la misma red WiFi:
1. Ver la IP de la PC POS: `ipconfig` → buscar IPv4 (ej. 192.168.0.50)
2. Abrir en el navegador: `http://192.168.0.50:3001`

---

## Configurar impresoras

1. Conectar las 2 impresoras USB POS-10881-UE
2. Abrir Administrador de Dispositivos → Puertos (COM y LPT) → ver COM asignados
3. En RestPOS → Configuracion → Impresoras:
   - Cocina (comandas): `COM3` (o el que corresponda)
   - Caja (tickets): `COM4` (o el que corresponda)
4. Click en "Test" para verificar

---

## Iniciar automaticamente con Windows

Para que RestPOS arranque solo al prender la PC:

1. Crear un archivo `start-restpos.bat` en `C:\restPOS\`:
```bat
@echo off
cd /d C:\restPOS
docker compose up -d
timeout /t 5
npm start -w server
```

2. Presionar Win+R → escribir `shell:startup` → Enter
3. Crear un acceso directo a `start-restpos.bat` en esa carpeta
