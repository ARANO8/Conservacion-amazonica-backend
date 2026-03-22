```mermaid
erDiagram

        Rol {
            ADMIN ADMIN
EJECUTIVO EJECUTIVO
TESORERO TESORERO
USUARIO USUARIO
        }
    


        EstadoSolicitud {
            PENDIENTE PENDIENTE
OBSERVADO OBSERVADO
DESEMBOLSADO DESEMBOLSADO
EJECUTADO EJECUTADO
        }
    


        EstadoPoa {
            ACTIVO ACTIVO
BLOQUEADO BLOQUEADO
        }
    


        TipoAccionHistorial {
            CREADO CREADO
APROBADO APROBADO
OBSERVADO OBSERVADO
DERIVADO DERIVADO
RECHAZADO RECHAZADO
        }
    


        TipoDestino {
            INSTITUCIONAL INSTITUCIONAL
TERCEROS TERCEROS
        }
    


        TipoDocumento {
            FACTURA FACTURA
RECIBO RECIBO
        }
    


        EstadoRendicion {
            PENDIENTE PENDIENTE
APROBADO APROBADO
OBSERVADO OBSERVADO
RECHAZADO RECHAZADO
APROBADA APROBADA
OBSERVADA OBSERVADA
RECHAZADA RECHAZADA
        }
    


        TipoNotificacion {
            SOLICITUD_ASIGNADA SOLICITUD_ASIGNADA
SOLICITUD_DERIVADA SOLICITUD_DERIVADA
SOLICITUD_APROBADA SOLICITUD_APROBADA
SOLICITUD_OBSERVADA SOLICITUD_OBSERVADA
RENDICION_PENDIENTE RENDICION_PENDIENTE
        }
    
  "Usuario" {
    Int id "🗝️"
    String email 
    String password 
    String nombreCompleto 
    Rol rol 
    String cargo "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "Proyecto" {
    Int id "🗝️"
    String nombre 
    DateTime deletedAt "❓"
    }
  

  "Grupo" {
    Int id "🗝️"
    String nombre 
    DateTime deletedAt "❓"
    }
  

  "Partida" {
    Int id "🗝️"
    String nombre 
    DateTime deletedAt "❓"
    }
  

  "CodigoPresupuestario" {
    Int id "🗝️"
    String codigoCompleto 
    }
  

  "Actividad" {
    Int id "🗝️"
    String detalleDescripcion 
    }
  

  "EstructuraProgramatica" {
    Int id "🗝️"
    }
  

  "Poa" {
    Int id "🗝️"
    String codigoPoa 
    Int cantidad 
    Decimal costoUnitario 
    Decimal costoTotal 
    Decimal montoEjecutado 
    EstadoPoa estado 
    DateTime deletedAt "❓"
    }
  

  "Solicitud" {
    Int id "🗝️"
    String codigoSolicitud 
    String descripcion "❓"
    DateTime fechaSolicitud 
    String motivoViaje "❓"
    String lugarViaje "❓"
    DateTime fechaInicio "❓"
    DateTime fechaFin "❓"
    String codigoDesembolso "❓"
    String urlComprobante "❓"
    String urlCuadroComparativo "❓"
    String urlCotizaciones 
    Decimal montoTotalNeto 
    Decimal montoTotalPresupuestado 
    EstadoSolicitud estado 
    String observacion "❓"
    DateTime deletedAt "❓"
    }
  

  "HistorialAprobacion" {
    Int id "🗝️"
    TipoAccionHistorial accion 
    String comentario "❓"
    DateTime fecha 
    }
  

  "Notificacion" {
    Int id "🗝️"
    String titulo 
    String mensaje 
    TipoNotificacion tipo 
    Boolean leida 
    String urlDestino "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "Rendicion" {
    Int id "🗝️"
    DateTime fechaRendicion 
    Decimal montoRespaldado 
    Decimal saldoLiquido 
    EstadoRendicion estado 
    String observaciones "❓"
    }
  

  "InformeGastos" {
    Int id "🗝️"
    DateTime fechaInicio 
    DateTime fechaFin 
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "ActividadInforme" {
    Int id "🗝️"
    DateTime fecha 
    String lugar 
    String personaInstitucion 
    String actividadesRealizadas 
    }
  

  "GastoRendicion" {
    Int id "🗝️"
    TipoDocumento tipoDocumento 
    String nroDocumento 
    DateTime fecha 
    String concepto 
    String detalle 
    String proveedor "❓"
    String urlComprobante 
    Decimal monto 
    Decimal montoBruto 
    Decimal montoImpuestos 
    Decimal montoNeto 
    }
  

  "DeclaracionJurada" {
    Int id "🗝️"
    DateTime fecha 
    String detalle 
    Decimal monto 
    }
  

  "SolicitudPresupuesto" {
    Int id "🗝️"
    Decimal subtotalNeto 
    Decimal subtotalPresupuestado 
    }
  

  "Planificacion" {
    Int id "🗝️"
    String actividadProgramada 
    Int cantidadPersonasInstitucional 
    Int cantidadPersonasTerceros 
    DateTime fechaInicio 
    DateTime fechaFin 
    Decimal diasCalculados 
    }
  

  "Concepto" {
    Int id "🗝️"
    String nombre 
    Decimal precioInstitucional 
    Decimal precioTerceros 
    }
  

  "Viatico" {
    Int id "🗝️"
    TipoDestino tipoDestino 
    Decimal dias 
    Int cantidadPersonas 
    Decimal costoUnitario 
    Decimal montoPresupuestado 
    Decimal iva13 
    Decimal it3 
    Decimal montoNeto 
    }
  

  "TipoGasto" {
    Int id "🗝️"
    String nombre 
    String codigo 
    }
  

  "Gasto" {
    Int id "🗝️"
    TipoDocumento tipoDocumento 
    Int cantidad 
    Decimal costoUnitario 
    Decimal montoPresupuestado 
    Decimal iva13 
    Decimal it3 
    Decimal iue5 
    Decimal montoNeto 
    String detalle "❓"
    }
  

  "PersonaExterna" {
    Int id "🗝️"
    String nombreCompleto 
    String procedenciaInstitucion 
    }
  

  "NominaTerceros" {
    Int id "🗝️"
    String nombreCompleto 
    String ci 
    }
  

  "CuentaBancaria" {
    Int id "🗝️"
    String numeroCuenta 
    String banco 
    String moneda 
    }
  

  "Hospedaje" {
    Int id "🗝️"
    String region 
    String destino 
    TipoDocumento tipoDocumento 
    Int personas 
    Int noches 
    Decimal cantidadUnitaria 
    Decimal costoTotal 
    Decimal iva 
    Decimal it 
    }
  
    "Usuario" |o--|| "Rol" : "enum:rol"
    "Proyecto" }o--|o "CuentaBancaria" : "cuentaBancaria"
    "EstructuraProgramatica" }o--|| "Proyecto" : "proyecto"
    "EstructuraProgramatica" }o--|| "Grupo" : "grupo"
    "EstructuraProgramatica" }o--|| "Partida" : "partida"
    "Poa" |o--|| "EstadoPoa" : "enum:estado"
    "Poa" }o--|| "EstructuraProgramatica" : "estructura"
    "Poa" }o--|| "CodigoPresupuestario" : "codigoPresupuestario"
    "Poa" }o--|| "Actividad" : "actividad"
    "Solicitud" |o--|| "EstadoSolicitud" : "enum:estado"
    "Solicitud" }o--|| "Usuario" : "usuarioEmisor"
    "Solicitud" }o--|o "Usuario" : "aprobador"
    "Solicitud" }o--|o "Usuario" : "usuarioBeneficiado"
    "HistorialAprobacion" |o--|| "TipoAccionHistorial" : "enum:accion"
    "HistorialAprobacion" }o--|| "Usuario" : "usuario"
    "HistorialAprobacion" }o--|o "Usuario" : "derivadoA"
    "HistorialAprobacion" }o--|o "Solicitud" : "solicitud"
    "HistorialAprobacion" }o--|o "Rendicion" : "rendicion"
    "Notificacion" |o--|| "TipoNotificacion" : "enum:tipo"
    "Notificacion" }o--|| "Usuario" : "usuario"
    "Notificacion" }o--|o "Solicitud" : "solicitud"
    "Rendicion" |o--|| "EstadoRendicion" : "enum:estado"
    "Rendicion" |o--|| "Solicitud" : "solicitud"
    "Rendicion" }o--|o "Usuario" : "aprobadorActual"
    "InformeGastos" |o--|| "Rendicion" : "rendicion"
    "ActividadInforme" }o--|| "InformeGastos" : "informe"
    "GastoRendicion" |o--|| "TipoDocumento" : "enum:tipoDocumento"
    "GastoRendicion" }o--|| "Rendicion" : "rendicion"
    "GastoRendicion" }o--|o "SolicitudPresupuesto" : "partida"
    "DeclaracionJurada" }o--|| "Rendicion" : "rendicion"
    "SolicitudPresupuesto" }o--|| "Solicitud" : "solicitud"
    "SolicitudPresupuesto" }o--|| "Poa" : "poa"
    "Planificacion" }o--|| "Solicitud" : "solicitud"
    "Planificacion" o{--}o "Viatico" : ""
    "Viatico" |o--|| "TipoDestino" : "enum:tipoDestino"
    "Viatico" }o--|| "Solicitud" : "solicitud"
    "Viatico" }o--|| "SolicitudPresupuesto" : "solicitudPresupuesto"
    "Viatico" }o--|| "Concepto" : "concepto"
    "Gasto" |o--|| "TipoDocumento" : "enum:tipoDocumento"
    "Gasto" }o--|| "Solicitud" : "solicitud"
    "Gasto" }o--|| "SolicitudPresupuesto" : "solicitudPresupuesto"
    "Gasto" }o--|| "TipoGasto" : "tipoGasto"
    "PersonaExterna" }o--|| "Solicitud" : "solicitud"
    "NominaTerceros" }o--|| "Solicitud" : "solicitud"
    "Hospedaje" |o--|| "TipoDocumento" : "enum:tipoDocumento"
    "Hospedaje" }o--|| "Solicitud" : "solicitud"
    "Hospedaje" }o--|| "Poa" : "poa"
```
