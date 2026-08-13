# Configuración de Clientes

## 1. Objetivo

Este documento describe cómo configurar clientes para el desarrollo de **Notas de Crédito Automáticas por Cliente** en NetSuite.

La configuración permite definir, sin modificar el código, qué Notas de Crédito deben generarse para cada cliente, qué artículo utilizar, qué concepto asignar y qué porcentaje aplicar sobre el subtotal de la factura.

---

## 2. Registro personalizado

El desarrollo utiliza el siguiente tipo de registro personalizado:

```text
customrecord_nc_cliente_desc
```

Nombre funcional:

```text
Clientes Descuento
```

Cada registro representa una regla independiente de generación de Nota de Crédito.

---

## 3. Campos utilizados

| Campo | Script ID | Descripción |
|---|---|---|
| Cliente | `custrecord_nc_config_cliente` | Cliente al que aplica la regla |
| Artículo | `custrecord_nc_articulo` | Artículo que se agregará a la NC |
| Concepto | `custrecord_nc_concepto` | Descripción funcional de la regla |
| Porcentaje | `custrecord_nc_porcentaje` | Porcentaje aplicado al subtotal |
| Inactivo | `isinactive` | Permite deshabilitar la regla |

---

## 4. Regla de configuración

La unidad lógica de configuración es:

```text
Cliente + Artículo
```

Un mismo cliente puede tener varias reglas activas.

Ejemplo:

| Cliente | Artículo | Concepto | Porcentaje |
|---|---|---|---:|
| CITY FRESKO | AS004 | Fee y servicios logísticos | 2.99% |
| CITY FRESKO | AS006-A | Fluctuación | 2.00% |
| CITY FRESKO | AS012 | Publicidad | 1.50% |

En este ejemplo, una factura timbrada del cliente CITY FRESKO puede generar tres Notas de Crédito.

---

## 5. Base de cálculo

La base utilizada por el desarrollo es el campo nativo:

```text
subtotal
```

Fórmula:

```text
Importe base de NC = Subtotal de factura × Porcentaje configurado
```

Ejemplo:

```text
Subtotal factura: 100,000.00
Porcentaje: 2.99%
Importe base NC: 2,990.00
```

Los impuestos son calculados por NetSuite de acuerdo con la configuración fiscal del artículo utilizado.

---

## 6. Alta de una nueva configuración

### Paso 1. Abrir el registro Clientes Descuento

Ir al tipo de registro personalizado:

```text
Clientes Descuento
```

Crear un registro nuevo.

### Paso 2. Seleccionar cliente

Elegir el cliente al que aplicará la regla.

### Paso 3. Seleccionar artículo

Seleccionar el artículo que debe aparecer en la Nota de Crédito.

Recomendaciones:

- El artículo debe existir.
- Debe estar activo.
- Debe estar disponible para la subsidiaria correspondiente.
- Debe tener la configuración fiscal necesaria.

### Paso 4. Capturar concepto

Ejemplos:

```text
Fee y servicios logísticos
Publicidad
Fluctuación
Margen comercial
Bonificación
```

### Paso 5. Capturar porcentaje

Ejemplo:

```text
2.99%
```

El script interpreta el porcentaje configurado y calcula el importe sobre el subtotal de la factura.

### Paso 6. Guardar

Una vez guardado, la configuración estará disponible para las siguientes facturas timbradas del cliente.

---

## 7. Desactivar una regla

No es necesario eliminarla.

Marcar:

```text
Inactivo = Sí
```

El User Event únicamente debe considerar configuraciones activas.

---

## 8. Modificar un porcentaje

Si cambia una condición comercial:

1. Abrir la regla existente.
2. Cambiar el porcentaje.
3. Guardar.

La modificación aplicará a facturas procesadas después del cambio.

No modifica Notas de Crédito ya creadas.

---

## 9. Agregar una nueva NC para un cliente existente

Crear un registro adicional con:

```text
Mismo cliente
+ Nuevo artículo
+ Nuevo concepto
+ Nuevo porcentaje
```

No es necesario modificar el script.

---

## 10. Ejemplo de múltiples configuraciones

Factura:

```text
Cliente: CITY FRESKO
Subtotal: 51,473.71
```

Configuración:

| Artículo | Porcentaje |
|---|---:|
| AS004 | 2.99% |
| AS006-A | 2.00% |
| AS012 | 1.50% |

Resultado:

| Artículo | Base NC |
|---|---:|
| AS004 | 1,539.06 |
| AS006-A | 1,029.47 |
| AS012 | 772.11 |

Total base:

```text
3,340.64
```

---

## 11. Validaciones recomendadas antes de guardar una regla

- [ ] Cliente correcto.
- [ ] Subsidiaria correcta.
- [ ] Artículo activo.
- [ ] Artículo disponible para la subsidiaria.
- [ ] Concepto definido.
- [ ] Porcentaje correcto.
- [ ] No existe una configuración duplicada Cliente + Artículo.
- [ ] El artículo tiene impuestos correctamente configurados.
- [ ] El artículo puede utilizarse en Nota de Crédito.

---

## 12. Consideraciones Sandbox / Producción

No asumir que los IDs internos numéricos son iguales entre ambientes.

Validar especialmente:

- Cliente.
- Artículo.
- Tipo de Nota de Crédito.
- Registros de relación CFDI.

Los Script IDs de los campos personalizados deben mantenerse iguales entre ambientes.

---

## 13. Configuración fiscal relacionada

Las Notas de Crédito automáticas utilizan:

```text
custbody_efx_nota_cre_tipo
```

con el tipo funcional:

```text
REBAJA SOBRE VENTA
```

Y el proceso de AutoTimbrado utiliza una configuración equivalente a:

```text
Relación CFDI: 01 - Nota de Crédito de los Documentos Relacionados
Uso CFDI: G02 - Devoluciones, Descuentos o Bonificaciones
Forma de pago: 03 - Transferencia Electrónica de Fondos
Método de pago: PUE - Pago en una Sola Exhibición
```

El ID interno numérico de estos valores debe verificarse en cada ambiente.

---

## 14. Checklist para nuevo cliente

Antes de liberar un cliente al proceso automático:

- [ ] Cliente identificado.
- [ ] Reglas comerciales confirmadas.
- [ ] Artículos definidos.
- [ ] Porcentajes confirmados.
- [ ] Configuración creada en Clientes Descuento.
- [ ] Configuración fiscal validada.
- [ ] Factura de prueba preparada.
- [ ] NC calculada manualmente para comparación.
- [ ] Prueba de creación completada.
- [ ] Prueba de AutoTimbrado completada.
