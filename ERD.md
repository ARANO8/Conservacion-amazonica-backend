```mermaid
erDiagram

        Rol {
            ADMIN ADMIN
EJECUTIVO EJECUTIVO
CONTADOR CONTADOR
TESORERO TESORERO
USUARIO USUARIO
VALIDADOR_COMPRAS VALIDADOR_COMPRAS
        }
    


        EstadoSolicitud {
            PENDIENTE PENDIENTE
OBSERVADO OBSERVADO
DESEMBOLSADO DESEMBOLSADO
EN_EJECUCION EN_EJECUCION
EJECUTADO EJECUTADO
        }
    


        EstadoPagoParcial {
            PLANIFICADO PLANIFICADO
SOLICITADO SOLICITADO
OBSERVADO OBSERVADO
APROBADO APROBADO
PAGADO PAGADO
        }
    


        TipoSolicitud {
            VIAJE VIAJE
COMPRA_SERVICIO COMPRA_SERVICIO
        }
    


        EstadoPoa {
            ACTIVO ACTIVO
BLOQUEADO BLOQUEADO
        }
    


        TipoAccionHistorial {
            CREADO CREADO
APROBADO APROBADO
OBSERVADO OBSERVADO
CORREGIDO CORREGIDO
DERIVADO DERIVADO
RECHAZADO RECHAZADO
ENVIADO ENVIADO
VALIDADO VALIDADO
        }
    


        TipoDestino {
            INSTITUCIONAL INSTITUCIONAL
TERCEROS TERCEROS
        }
    


        TipoDocumento {
            FACTURA FACTURA
RECIBO RECIBO
BOLETA BOLETA
LV LV
DJ DJ
PPT PPT
PAT PAT
PVT PVT
        }
    


        EstadoRendicion {
            PENDIENTE PENDIENTE
APROBADO APROBADO
OBSERVADO OBSERVADO
RECHAZADO RECHAZADO
        }
    


        TipoNotificacion {
            SOLICITUD_ASIGNADA SOLICITUD_ASIGNADA
SOLICITUD_DERIVADA SOLICITUD_DERIVADA
SOLICITUD_APROBADA SOLICITUD_APROBADA
SOLICITUD_OBSERVADA SOLICITUD_OBSERVADA
RENDICION_PENDIENTE RENDICION_PENDIENTE
RENDICION_OBSERVADA RENDICION_OBSERVADA
CUADRO_PENDIENTE_VALIDACION CUADRO_PENDIENTE_VALIDACION
CUADRO_PENDIENTE_REVISION CUADRO_PENDIENTE_REVISION
CUADRO_OBSERVADO CUADRO_OBSERVADO
CUADRO_APROBADO CUADRO_APROBADO
PAGO_PENDIENTE_APROBACION PAGO_PENDIENTE_APROBACION
PAGO_OBSERVADO PAGO_OBSERVADO
PAGO_REALIZADO PAGO_REALIZADO
        }
    


        TipoCotizacion {
            PROPIA PROPIA
EXTERNA EXTERNA
        }
    


        EstadoCuadroComparativo {
            BORRADOR BORRADOR
EN_REVISION EN_REVISION
EN_VALIDACION EN_VALIDACION
REVISADO REVISADO
EN_APROBACION EN_APROBACION
OBSERVADO OBSERVADO
APROBADO APROBADO
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
  

  "PartidaContable" {
    Int id "🗝️"
    String codigo 
    String nombre 
    String descripcion "❓"
    Int nivel 
    String tipo "❓"
    String monetaria "❓"
    String auxiliar "❓"
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
    DateTime createdAt 
    DateTime updatedAt 
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
    TipoSolicitud tipo 
    String proyecto "❓"
    String chequeANombreDe "❓"
    String banco "❓"
    DateTime fechaDesembolso "❓"
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
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
    String comprobanteUrl "❓"
    DateTime deletedAt "❓"
    DateTime createdAt 
    DateTime updatedAt 
    }
  

  "InformeActividades" {
    Int id "🗝️"
    String codigoInforme 
    DateTime fechaInicio 
    DateTime fechaFin 
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "ActividadInforme" {
    Int id "🗝️"
    DateTime fecha 
    String lugar 
    String personaInstitucion 
    String actividadesRealizadas 
    }
  

  "DeclaracionMovilidad" {
    Int id "🗝️"
    String codigoDeclaracion 
    String cargo 
    String motivoActividad 
    String proyectoPartida 
    String lugarEmision 
    DateTime fechaEmision 
    Decimal totalBruto 
    Decimal retencion 
    Decimal totalLiquido 
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "DetalleMovilidad" {
    Int id "🗝️"
    Int orden 
    DateTime fecha 
    String origen 
    String destino 
    String motivo 
    Decimal montoGastado 
    Decimal monto 
    }
  

  "GastoRendicion" {
    Int id "🗝️"
    TipoDocumento tipoDocumento 
    String tipoRetencion "❓"
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
  

  "GastoCompra" {
    Int id "🗝️"
    Decimal cantidad 
    String descripcion 
    String uso "❓"
    Decimal costoUnitario 
    Decimal total 
    TipoDocumento tipoDocumento 
    Decimal montoPresupuestado 
    Decimal iva 
    Decimal it 
    DateTime deletedAt "❓"
    }
  

  "PagoParcial" {
    Int id "🗝️"
    Int numero 
    Decimal monto 
    DateTime fechaPago 
    String descripcion "❓"
    EstadoPagoParcial estado 
    String urlComprobante "❓"
    String urlInforme "❓"
    DateTime fechaPagoReal "❓"
    String observacion "❓"
    DateTime createdAt 
    DateTime updatedAt 
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
  

  "Cotizacion" {
    Int id "🗝️"
    String codigoCotizacion 
    DateTime fecha 
    TipoCotizacion tipo 
    String proveedorNombre 
    String proveedorTelefono "❓"
    String proveedorDireccion "❓"
    String proveedorCorreo "❓"
    String garantia "❓"
    String disponibilidad "❓"
    String duracionCotizacion "❓"
    Boolean emiteFactura 
    String observaciones "❓"
    String adjuntoUrl "❓"
    Decimal total 
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "LineaCotizacion" {
    Int id "🗝️"
    Decimal cantidad 
    String unidad "❓"
    String detalle 
    Decimal precioUnitario 
    Decimal total 
    }
  

  "CuadroComparativo" {
    Int id "🗝️"
    String codigoCuadro 
    String lugarFecha "❓"
    String observaciones "❓"
    EstadoCuadroComparativo estado 
    Decimal totalRecomendado "❓"
    String motivoObservacion "❓"
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "CuadroCotizacion" {
    Int id "🗝️"
    Int orden 
    String proveedorNombre 
    Decimal total 
    }
  

  "CuadroItem" {
    Int id "🗝️"
    Int orden 
    String descripcion 
    Decimal cantidad 
    String unidad "❓"
    }
  

  "CuadroPrecio" {
    Int id "🗝️"
    Decimal precioUnitario "❓"
    Decimal total "❓"
    Boolean noMenciona 
    }
  

  "OrdenCompra" {
    Int id "🗝️"
    String codigoOrden 
    DateTime fecha 
    String proveedorNombre 
    String proveedorDireccion "❓"
    String proveedorTelefono "❓"
    String lugarEntrega "❓"
    String formaPago 
    String garantia 
    String observaciones "❓"
    Decimal total 
    DateTime createdAt 
    DateTime updatedAt 
    DateTime deletedAt "❓"
    }
  

  "OrdenCompraItem" {
    Int id "🗝️"
    Int orden 
    String item 
    Decimal cantidad 
    String unidad "❓"
    String detalle "❓"
    Decimal precioUnitario 
    Decimal total 
    Boolean sinCuadro 
    }
  
    "Usuario" |o--|| "Rol" : "enum:rol"
    "Proyecto" }o--|o "CuentaBancaria" : "cuentaBancaria"
    "PartidaContable" |o--|o "PartidaContable" : "parent"
    "EstructuraProgramatica" }o--|| "Proyecto" : "proyecto"
    "EstructuraProgramatica" }o--|| "Grupo" : "grupo"
    "EstructuraProgramatica" }o--|| "Partida" : "partida"
    "Poa" |o--|| "EstadoPoa" : "enum:estado"
    "Poa" }o--|| "EstructuraProgramatica" : "estructura"
    "Poa" }o--|| "CodigoPresupuestario" : "codigoPresupuestario"
    "Poa" }o--|| "Actividad" : "actividad"
    "Solicitud" |o--|| "EstadoSolicitud" : "enum:estado"
    "Solicitud" |o--|| "TipoSolicitud" : "enum:tipo"
    "Solicitud" }o--|| "Usuario" : "usuarioEmisor"
    "Solicitud" }o--|o "Usuario" : "aprobador"
    "Solicitud" }o--|o "Usuario" : "usuarioBeneficiado"
    "HistorialAprobacion" |o--|| "TipoAccionHistorial" : "enum:accion"
    "HistorialAprobacion" }o--|| "Usuario" : "usuario"
    "HistorialAprobacion" }o--|o "Usuario" : "derivadoA"
    "HistorialAprobacion" }o--|o "Solicitud" : "solicitud"
    "HistorialAprobacion" }o--|o "Rendicion" : "rendicion"
    "HistorialAprobacion" }o--|o "CuadroComparativo" : "cuadroComparativo"
    "Notificacion" |o--|| "TipoNotificacion" : "enum:tipo"
    "Notificacion" }o--|| "Usuario" : "usuario"
    "Notificacion" }o--|o "Solicitud" : "solicitud"
    "Notificacion" }o--|o "CuadroComparativo" : "cuadroComparativo"
    "Rendicion" |o--|| "EstadoRendicion" : "enum:estado"
    "Rendicion" |o--|| "Solicitud" : "solicitud"
    "Rendicion" }o--|o "Usuario" : "aprobadorActual"
    "InformeActividades" }o--|| "Usuario" : "usuario"
    "ActividadInforme" }o--|| "InformeActividades" : "informe"
    "DeclaracionMovilidad" }o--|| "Usuario" : "usuario"
    "DetalleMovilidad" }o--|| "DeclaracionMovilidad" : "declaracion"
    "GastoRendicion" |o--|| "TipoDocumento" : "enum:tipoDocumento"
    "GastoRendicion" }o--|| "Rendicion" : "rendicion"
    "GastoRendicion" }o--|o "SolicitudPresupuesto" : "partida"
    "GastoRendicion" }o--|o "PartidaContable" : "partidaContable"
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
    "PersonaExterna" }o--|o "Planificacion" : "planificacion"
    "GastoCompra" |o--|| "TipoDocumento" : "enum:tipoDocumento"
    "GastoCompra" }o--|| "Solicitud" : "solicitud"
    "GastoCompra" }o--|| "SolicitudPresupuesto" : "solicitudPresupuesto"
    "PagoParcial" |o--|| "EstadoPagoParcial" : "enum:estado"
    "PagoParcial" }o--|o "Usuario" : "solicitadoPor"
    "PagoParcial" }o--|o "Usuario" : "aprobador"
    "PagoParcial" }o--|o "Usuario" : "pagadoPor"
    "PagoParcial" }o--|| "GastoCompra" : "gastoCompra"
    "Hospedaje" |o--|| "TipoDocumento" : "enum:tipoDocumento"
    "Hospedaje" }o--|| "Solicitud" : "solicitud"
    "Hospedaje" }o--|| "Poa" : "poa"
    "Cotizacion" |o--|| "TipoCotizacion" : "enum:tipo"
    "Cotizacion" }o--|| "Usuario" : "usuarioEmisor"
    "LineaCotizacion" }o--|| "Cotizacion" : "cotizacion"
    "CuadroComparativo" |o--|| "EstadoCuadroComparativo" : "enum:estado"
    "CuadroComparativo" }o--|| "Usuario" : "usuarioEmisor"
    "CuadroComparativo" }o--|o "CuadroCotizacion" : "cotizacionRecomendada"
    "CuadroCotizacion" }o--|| "CuadroComparativo" : "cuadro"
    "CuadroCotizacion" }o--|| "Cotizacion" : "cotizacion"
    "CuadroItem" }o--|| "CuadroComparativo" : "cuadro"
    "CuadroItem" }o--|o "CuadroCotizacion" : "cotizacionGanadora"
    "CuadroPrecio" }o--|| "CuadroItem" : "cuadroItem"
    "CuadroPrecio" }o--|| "CuadroCotizacion" : "cuadroCotizacion"
    "OrdenCompra" }o--|o "CuadroComparativo" : "cuadroComparativo"
    "OrdenCompra" }o--|| "Usuario" : "usuarioEmisor"
    "OrdenCompraItem" }o--|o "CuadroItem" : "cuadroItem"
    "OrdenCompraItem" }o--|| "OrdenCompra" : "ordenCompra"
```
