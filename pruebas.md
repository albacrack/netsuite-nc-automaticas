# Plan de Pruebas

## 1. Objetivo

Validar que el desarrollo de **Notas de Crédito Automáticas por Cliente** funcione correctamente antes de liberarlo en Producción y después de cualquier cambio relevante.

---

## 2. Alcance de pruebas

Se deben validar:

- Detección de factura timbrada.
- Configuración por cliente.
- Cálculo de importes.
- Creación de una NC.
- Creación de múltiples NC.
- Aplicación a factura.
- Prevención de duplicados.
- Limpieza fiscal.
- Tipo de Nota de Crédito.
- Autocertificación.
- Related CFDI.
- AutoTimbrado.
- Manejo de errores.

---

## 3. Datos base

Preparar al menos:

### Cliente A

```text
1 configuración
```

Ejemplo:

```text
AS004
Fee
7.00%
```

### Cliente B

```text
3 configuraciones
```

Ejemplo:

```text
AS004 2.99%
AS006-A 2.00%
AS012 1.50%
```

---

## 4. Caso P01 - Factura sin UUID

### Entrada

```text
Factura guardada
UUID vacío
Cliente configurado
```

### Resultado esperado

```text
No se crea NC
Factura no se marca procesada
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 5. Caso P02 - Cliente sin configuración

### Entrada

```text
Factura con UUID
Cliente no existe en Clientes Descuento
```

### Resultado esperado

```text
No se crea NC
No se genera error
Factura no debe producir NC
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 6. Caso P03 - Una configuración

### Entrada

```text
Subtotal: 24,594.93
Porcentaje: 7.00%
```

### Cálculo esperado

```text
24,594.93 × 7% = 1,721.6451
```

Importe esperado redondeado:

```text
1,721.65
```

### Validar

- [ ] Se crea una sola NC.
- [ ] Artículo correcto.
- [ ] Base = 1,721.65.
- [ ] Impuesto calculado por NetSuite.
- [ ] NC aplicada a la factura.
- [ ] Configuración origen llena.
- [ ] Tipo NC lleno.
- [ ] Autocertify marcado.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 7. Caso P04 - Múltiples configuraciones

### Entrada

```text
Subtotal: 51,473.71
```

Reglas:

```text
2.99%
2.00%
1.50%
```

### Resultado esperado

| Regla | Base |
|---|---:|
| 2.99% | 1,539.06 |
| 2.00% | 1,029.47 |
| 1.50% | 772.11 |
| Total | 3,340.64 |

### Validar

- [ ] Se crean tres NC.
- [ ] Cada NC corresponde a una configuración.
- [ ] No se mezclan artículos.
- [ ] Todas se aplican a la misma factura.
- [ ] Ninguna queda duplicada.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 8. Caso P05 - Saldo insuficiente

### Entrada

Factura con saldo menor al total de NC incluyendo impuestos.

### Resultado esperado

```text
El proceso se detiene antes de crear parcialmente las NC.
```

Validar:

- [ ] No quedan NC parciales.
- [ ] Factura no se marca procesada.
- [ ] Log de error claro.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 9. Caso P06 - Prevención de duplicados

### Entrada

Ejecutar nuevamente una factura ya procesada.

### Resultado esperado

```text
No se generan NC adicionales.
```

Validar:

```text
createdfrom
+
custbody_nc_auto_config_origen
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 10. Caso P07 - Ejecución parcial recuperable

### Escenario

Existen tres configuraciones.

Una NC ya existe y dos no.

### Resultado esperado

El proceso debe:

```text
Detectar NC existente
No duplicarla
Crear únicamente las dos faltantes
Verificar las tres
Marcar factura procesada
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 11. Caso P08 - Limpieza fiscal

### Validar en NC recién creada

Debe quedar vacío:

```text
custbody_mx_cfdi_uuid
custbody_mx_plus_xml_certificado
custbody_mx_plus_xml_generado
custbody_edoc_generated_pdf
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 12. Caso P09 - Tipo de Nota de Crédito

Validar:

```text
custbody_efx_nota_cre_tipo
```

Resultado esperado:

```text
REBAJA SOBRE VENTA
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 13. Caso P10 - Autocertificación

Validar:

```text
custbody_efx_fe_autocertify = true
```

Resultado esperado:

```text
Casilla marcada
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 14. Caso P11 - Related CFDI

Validar que el AutoTimbrado genere:

```text
Relationship Type:
01 - Nota de Crédito de los Documentos Relacionados
```

Y que:

```text
Related CFDI = Factura origen
UUID relacionado = UUID factura origen
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 15. Caso P12 - AutoTimbrado completo

Validar flujo:

```text
NC pendiente
→ búsqueda AutoTimbrado
→ reduce
→ relacionaNC
→ Related CFDI
→ segundo guardado
→ crearXML
→ timbrado
→ PDF
```

Resultado esperado:

- [ ] UUID propio.
- [ ] XML generado.
- [ ] PDF generado.
- [ ] NC deja de aparecer como pendiente.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 16. Caso P13 - Falta Tipo NC

### Entrada

NC con:

```text
custbody_efx_nota_cre_tipo = vacío
```

### Resultado esperado

El proceso de relación CFDI no debe continuar como si fuera válido.

Debe registrarse la causa en logs.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 17. Caso P14 - Columna faltante en Saved Search

### Escenario

Quitar temporalmente en Sandbox una columna requerida, por ejemplo:

```text
Applied To Transaction : Type
```

### Resultado esperado

La lectura defensiva del Map/Reduce evita errores directos del tipo:

```text
Cannot read property 'value' of undefined
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 18. Caso P15 - Regla inactiva

### Entrada

Configuración:

```text
isinactive = true
```

### Resultado esperado

```text
La regla no genera NC.
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 19. Caso P16 - Modificación de porcentaje

### Entrada

Cambiar:

```text
2.99% → 3.00%
```

Crear nueva factura.

### Resultado esperado

La nueva NC utiliza:

```text
3.00%
```

Las NC históricas no cambian.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 20. Caso P17 - Nuevo cliente

Crear configuración para un cliente no utilizado anteriormente.

### Resultado esperado

El desarrollo funciona sin cambio de código.

Estado:

- [ ] PASS
- [ ] FAIL

---

## 21. Caso P18 - Usuario vuelve a guardar factura procesada

### Entrada

Factura:

```text
custbody_nc_auto_procesadas = true
```

Editar y guardar nuevamente.

### Resultado esperado

```text
No genera nuevas NC.
```

Estado:

- [ ] PASS
- [ ] FAIL

---

## 22. Evidencias

Para cada prueba guardar:

- Internal ID factura.
- Número de factura.
- Internal ID de NC.
- Captura de configuración.
- Captura de aplicación.
- Captura de Related CFDI.
- UUID factura.
- UUID NC.
- Logs relevantes.
- Resultado PASS / FAIL.

---

## 23. Formato de evidencia

Ejemplo:

```text
Caso: P04 - Múltiples configuraciones
Ambiente: Sandbox
Factura: FACVTAMA21691
Internal ID: 326416
Subtotal: 51,473.71

NC 1:
Artículo: AS004
Base: 1,539.06

NC 2:
Artículo: AS006-A
Base: 1,029.47

NC 3:
Artículo: AS012
Base: 772.11

Resultado:
PASS
```

---

## 24. Criterio de aceptación para Producción

El desarrollo puede considerarse listo cuando:

- [ ] P01 a P12 pasan correctamente.
- [ ] No existen duplicados.
- [ ] NC se aplican correctamente.
- [ ] Related CFDI es correcto.
- [ ] Autocertify funciona.
- [ ] Timbrado genera UUID/XML/PDF.
- [ ] Se prueba al menos un cliente de una regla.
- [ ] Se prueba al menos un cliente de múltiples reglas.
- [ ] Se revisan logs productivos.
