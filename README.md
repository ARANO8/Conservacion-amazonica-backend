<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

# Conservación Amazónica - ACEAA Backend

Sistema de gestión para la administración de solicitudes de fondos, presupuestos y procesos operativos de Conservación Amazónica.

##  Arquitectura de Datos

El sistema gestiona una relación compleja entre solicitudes y presupuestos basada en la disponibilidad del POA (Plan Operativo Anual).

- **Relación N:M**: Una **Solicitud** puede estar vinculada a múltiples **Presupuestos** a través de una tabla de unión.
- **Ciclo de Reservas**:
  - `RESERVADO`: El fondo está bloqueado temporalmente por un usuario.
  - `CONFIRMADO`: La solicitud ha sido creada y los fondos están oficialmente comprometidos.
- **Estructura Programática**: Integración multinivel de Proyecto -> Grupo -> Partida -> Actividad POA.

##  Lógica Financiera (Gross-up Aditivo)

El backend implementa una lógica de cálculo **Aditiva** para simplificar la entrada de datos del usuario:

1. **Entrada**: El usuario ingresa el `montoNeto` (el monto líquido que se desea recibir o pagar).
2. **Cálculo**: El sistema aplica las tasas impositivas configuradas (IVA, IT, IUE) sobre el neto.
3. **Resultado**: Se obtiene el `montoPresupuestado`, que representa el costo total real para la institución.

> [!NOTE]
> Todos los cálculos financieros utilizan la librería `Decimal.js` (vía Prisma) para garantizar precisión decimal y evitar errores de coma flotante, con redondeo estricto a 2 decimales.

##  Seguridad y Sanitización

- **Protección de Datos**: Todas las respuestas de la API que involucran objetos de usuario están sanitizadas.
- **Exclusión de Passwords**: Los hashes de contraseñas se eliminan explícitamente en la capa de servicio tanto en el módulo de `Usuarios` como en las relaciones de `Solicitudes` (Emisor, Aprobador).

##  Validaciones de Negocio

Se aplican reglas estrictas de integridad antes de persistir cualquier solicitud:
- **Días de Viático**: La cantidad de días solicitados no puede exceder la duración de la actividad planificada.
- **Capacidad de Personas**: El número de beneficiarios de viáticos debe ser menor o igual a la capacidad planificada (Institucional + Terceros).
- **Flujo de Aprobación**: Validación de estados para permitir transiciones solo entre estados válidos (`PENDIENTE`, `OBSERVADO`, `DESEMBOLSADO`).

## 🛠️ Setup Rápido

### Requisitos
- Node.js (v18+)
- pnpm

### Instalación
```bash
# 1. Instalar dependencias
$ pnpm install

# 2. Configurar base de datos (copiar .env.example a .env)
# 3. Correr migraciones de Prisma
$ npx prisma migrate dev

# 4. (Opcional) Cargar datos iniciales
$ pnpm run seed
```

### Ejecución
```bash
# Desarrollo
$ pnpm run start:dev

# Producción
$ pnpm run build
$ pnpm run start:prod
```

## 📄 Licencia
Este proyecto es propiedad privada de Conservación Amazónica - ACEAA.
