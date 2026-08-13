# Changelog

Todos los cambios relevantes del proyecto **Notas de Crédito Automáticas por Cliente en NetSuite** se documentarán en este archivo.

El formato sigue una estructura inspirada en Keep a Changelog.

---

## [Unreleased]

### Added

- Campo `custbody_efx_fe_autocertify` marcado automáticamente en las Notas de Crédito generadas.

### Changed

- Eliminación del candado de factura de prueba para permitir el procesamiento general de clientes configurados.

### Pending

- Continuar monitoreo productivo.
- Validar incorporación de nuevos clientes.
- Evaluar parametrización del Tipo de Nota para evitar IDs numéricos hardcodeados.
- Separar completamente la integración propia del código administrado por proveedores externos.

---

## [1.0.0] - 2026-08-13

### Added

- Creación automática de Notas de Crédito desde Facturas de Venta timbradas.
- Disparador basado en:
  - `custbody_mx_cfdi_uuid`
- Registro de configuración:
  - `customrecord_nc_cliente_desc`
- Configuración por cliente, artículo, concepto y porcentaje.
- Soporte para múltiples NC por factura.
- Cálculo basado en subtotal de la factura.
- Creación mediante transformación:
  - Invoice → Credit Memo.
- Eliminación de líneas heredadas de la factura.
- Creación de línea con artículo de servicio configurado.
- Precio personalizado.
- Aplicación automática contra factura origen.
- Campo de control:
  - `custbody_nc_auto_procesadas`
- Campo de configuración origen:
  - `custbody_nc_auto_config_origen`
- Prevención de duplicados por:
  - Factura origen.
  - Configuración origen.
- Validación de saldo suficiente.
- Limpieza de datos fiscales heredados:
  - `custbody_mx_cfdi_uuid`
  - `custbody_mx_plus_xml_certificado`
  - `custbody_mx_plus_xml_generado`
  - `custbody_edoc_generated_pdf`
- Asignación de Tipo de Nota de Crédito:
  - `custbody_efx_nota_cre_tipo`
- Integración con AutoTimbrado Map/Reduce.
- Lectura defensiva de resultados de Saved Search.
- Soporte para:
  - `createdfrom`
  - `appliedtotransaction`
  - `type.createdFrom`
  - `type.appliedToTransaction`
- Creación de Related CFDI.
- Relación fiscal:
  - `01 - Nota de Crédito de los Documentos Relacionados`
- Relación de UUID de factura origen.
- Segundo guardado previo a generación XML.
- Integración con servicio MX+.
- Generación de XML y PDF.
- Pruebas con clientes de una configuración.
- Pruebas con clientes de múltiples configuraciones.

### Fixed

- Error de despliegue causado por parámetro con prefijo duplicado:
  - incorrecto: `custscriptcustscript_nc_factura_prueba`
  - correcto: `custscript_nc_factura_prueba`
- Error:
  - `INVALID_RCRD_TYPE`
  provocado por diferencias de Script ID entre ambientes.
- Error:
  - `SSS_MISSING_REQD_ARGUMENT`
  en `runtime.getCurrentScript().getParameter`.
- Error:
  - `Cannot read property 'value' of undefined`
  en el AutoTimbrado.
- Manejo alternativo de:
  - `type.createdFrom`
  - `type.appliedToTransaction`
- Problemas de relación CFDI cuando `tipoNC` no era devuelto por la Saved Search.

---

## Convención de versiones

```text
MAJOR.MINOR.PATCH
```

Ejemplo:

```text
1.2.3
```

- **MAJOR:** cambios incompatibles o rediseño importante.
- **MINOR:** nueva funcionalidad compatible.
- **PATCH:** correcciones sin cambio funcional mayor.

---

## Convención recomendada de commits

Ejemplos:

```text
feat: agrega autocertificacion a notas de credito
fix: corrige lectura de applied transaction
fix: evita duplicados por configuracion
docs: agrega documentacion de despliegue
test: agrega pruebas para multiples configuraciones
refactor: separa configuracion fiscal del codigo
```
