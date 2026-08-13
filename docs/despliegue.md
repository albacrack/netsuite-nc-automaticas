# Despliegue

## 1. Objetivo

Este documento describe el procedimiento recomendado para desplegar el desarrollo de **Notas de Crédito Automáticas por Cliente** en NetSuite.

El desarrollo contiene dos componentes principales:

1. User Event para creación automática de NC.
2. Map/Reduce de AutoTimbrado para procesar las NC generadas.

---

## 2. Componentes requeridos

### User Event

Archivo sugerido:

```text
NC_Automaticas_Cliente_UE.js
```

Tipo:

```text
User Event Script
```

Registro:

```text
Factura de Venta
```

Evento:

```text
afterSubmit
```

### AutoTimbrado

Archivo sugerido:

```text
EFX_FE_AutoTimbrado_NC_MR.js
```

Tipo:

```text
Map/Reduce Script
```

---

## 3. Dependencias

Antes de desplegar, validar que existan:

### Registro personalizado

```text
customrecord_nc_cliente_desc
```

### Campos de configuración

```text
custrecord_nc_config_cliente
custrecord_nc_articulo
custrecord_nc_concepto
custrecord_nc_porcentaje
```

### Campos de Factura / Nota de Crédito

```text
custbody_mx_cfdi_uuid
custbody_nc_auto_procesadas
custbody_nc_auto_config_origen
custbody_efx_nota_cre_tipo
custbody_efx_fe_autocertify
```

### Campos fiscales que se limpian

```text
custbody_mx_cfdi_uuid
custbody_mx_plus_xml_certificado
custbody_mx_plus_xml_generado
custbody_edoc_generated_pdf
```

---

## 4. Despliegue del User Event

### Paso 1. Subir archivo

Subir el archivo a:

```text
Documents > SuiteScripts
```

o a la carpeta de scripts definida por el proyecto.

### Paso 2. Crear registro de Script

Crear un nuevo registro para el User Event.

Ejemplo:

```text
Nombre: NC automáticas por cliente
Script ID: customscript_nc_automaticas_por_cliente
```

### Paso 3. Crear despliegue

Ejemplo:

```text
Script ID:
customdeploy_nc_automaticas_por_cliente

Aplica a:
Factura de venta

Desplegado:
Sí

Estado:
Liberado
```

### Paso 4. Verificar entry point

Debe existir:

```text
afterSubmit
```

### Paso 5. Verificar audiencia

Durante pruebas se recomienda incluir:

```text
Administrador
```

o la audiencia interna requerida.

### Paso 6. Verificar Context Filtering

No excluir el contexto utilizado por el proceso de timbrado.

---

## 5. Parámetro de factura de prueba

Durante las pruebas se utilizó un parámetro de seguridad:

```text
custscript_nc_factura_prueba
```

Este parámetro limitaba la ejecución a una sola factura.

Una vez validado el desarrollo productivo, este candado puede retirarse del código.

El parámetro puede permanecer creado aunque ya no se utilice.

---

## 6. Despliegue del AutoTimbrado

Se recomienda crear:

- Un registro de script independiente.
- Un despliegue independiente.
- Una búsqueda guardada específica para NC automáticas.

Esto evita modificar directamente el despliegue original del proveedor.

Ejemplo:

```text
Script:
EFX FE - AutoTimbrado NC Automáticas

Deployment:
EFX FE - AutoTimbrado NC Automáticas PROD
```

---

## 7. Parámetro de búsqueda del AutoTimbrado

El Map/Reduce obtiene una Saved Search mediante:

```text
custscript_efx_fe_autotimbrado_bg
```

En el despliegue debe configurarse la búsqueda productiva correspondiente.

---

## 8. Resultados requeridos en la Saved Search

La búsqueda debe incluir como mínimo:

```text
Type
UUID propio
Created From
Applied To Transaction
Created From : Type
o
Applied To Transaction : Type
Applied To Transaction : UUID
Tipo de Nota de Crédito
```

Propiedades utilizadas por el script:

```text
type
createdfrom
appliedtotransaction
type.createdFrom
type.appliedToTransaction
custbody_mx_cfdi_uuid
custbody_mx_cfdi_uuid.appliedToTransaction
custbody_efx_nota_cre_tipo
```

---

## 9. Criterio recomendado de salida del AutoTimbrado

La búsqueda debe evitar volver a procesar una NC ya timbrada.

Validar que el criterio considere:

```text
UUID propio de la Nota de Crédito = vacío
```

No confundirlo con:

```text
UUID de Applied To Transaction
```

El segundo corresponde al UUID de la factura relacionada.

---

## 10. Configuración EFX FE - Relación NC

Validar que exista un registro para:

```text
REBAJA SOBRE VENTA
```

con una configuración equivalente a:

```text
Tipo de Relación:
01 - Nota de Crédito de los Documentos Relacionados

Uso CFDI:
G02 - Devoluciones, Descuentos o Bonificaciones

Forma de pago:
03 - Transferencia Electrónica de Fondos

Método de pago:
PUE - Pago en una Sola Exhibición
```

---

## 11. Prueba inicial en Producción

No liberar inmediatamente todos los clientes.

Orden recomendado:

### Prueba 1

Cliente con una sola configuración.

Validar:

```text
Factura
→ NC
→ Aplicación
→ Related CFDI
→ Timbrado
```

### Prueba 2

Cliente con múltiples configuraciones.

Validar:

```text
1 factura
→ varias NC
→ aplicación correcta
→ timbrado individual
```

---

## 12. Verificaciones posteriores al despliegue

### Factura

- [ ] UUID presente.
- [ ] Cliente configurado.
- [ ] Procesada inicialmente desmarcada.
- [ ] Saldo suficiente.

### Nota de Crédito

- [ ] Artículo correcto.
- [ ] Importe correcto.
- [ ] Configuración origen llena.
- [ ] Tipo de Nota lleno.
- [ ] Autocertify marcado.
- [ ] UUID heredado vacío.
- [ ] XML heredado vacío.
- [ ] PDF heredado vacío.
- [ ] Aplicada a la factura correcta.

### AutoTimbrado

- [ ] NC aparece en la búsqueda.
- [ ] Tipo NC disponible.
- [ ] UUID de factura disponible.
- [ ] Related CFDI creado.
- [ ] Segundo guardado ejecutado.
- [ ] XML generado.
- [ ] UUID generado.
- [ ] PDF generado.

---

## 13. Logs

Durante despliegue inicial utilizar:

```text
Nivel de log: Depurar
```

Después de estabilizar:

```text
Nivel de log: Auditoría
```

Logs útiles:

```text
Factura detectada
Cliente
Subtotal
Configuraciones encontradas
NC calculada
NC creada
Aplicación
Tipo de Nota
Autocertify
Related CFDI
Segundo guardado
Resultado de timbrado
```

---

## 14. Seguridad contra duplicados

No retirar las validaciones:

```text
Factura procesada
+
Factura origen
+
Configuración origen
```

La factura únicamente debe marcarse procesada cuando todas las configuraciones tengan una NC válida.

---

## 15. Consideraciones Sandbox / Producción

Revisar:

- Script IDs.
- IDs internos numéricos.
- Clientes.
- Artículos.
- Tipos de Nota.
- Tipos de relación CFDI.
- Saved Searches.
- Despliegues.
- Audiencias.
- Contextos.

No asumir que un Internal ID numérico de Sandbox es válido en Producción.

---

## 16. Rollback

Si se detecta un problema después del despliegue:

1. Deshabilitar el despliegue del User Event.
2. Deshabilitar el despliegue del AutoTimbrado NC.
3. No eliminar transacciones automáticamente.
4. Revisar NC creadas.
5. Identificar facturas procesadas.
6. Corregir la causa.
7. Probar con una factura controlada.
8. Liberar nuevamente.

---

## 17. Checklist de liberación

- [ ] Código versionado.
- [ ] Backup de versión previa.
- [ ] Registro Clientes Descuento existe.
- [ ] Campos requeridos existen.
- [ ] User Event desplegado.
- [ ] AutoTimbrado desplegado.
- [ ] Saved Search configurada.
- [ ] Relación CFDI configurada.
- [ ] Tipo NC configurado.
- [ ] Autocertify activo.
- [ ] Prueba con una NC completada.
- [ ] Prueba con múltiples NC completada.
- [ ] Duplicados validados.
- [ ] Logs revisados.
- [ ] Equipo funcional informado.
