/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

define(
    ['N/record', 'N/search', 'N/runtime', 'N/log'],
    (record, search, runtime, log) => {

        const IDS = {
            UUID: 'custbody_mx_cfdi_uuid',
            PROCESSED: 'custbody_nc_auto_procesadas',
            CFDI_XML_CERTIFICADO: 'custbody_mx_plus_xml_certificado',
            CFDI_XML_GENERADO: 'custbody_mx_plus_xml_generado',
            CFDI_PDF: 'custbody_edoc_generated_pdf',
            CREDIT_MEMO_TYPE: 'custbody_efx_nota_cre_tipo',
            autocertify: 'custobody_efx_fe_autocertify',




            CONFIG_RECORD: 'customrecord_nc_cliente_desc',
            CONFIG_CUSTOMER: 'custrecord_nc_config_cliente',
            CONFIG_ITEM: 'custrecord_nc_articulo',
            CONFIG_CONCEPT: 'custrecord_nc_concepto',
            CONFIG_PERCENT: 'custrecord_nc_porcentaje',

            CREDIT_CONFIG_ORIGIN:
                'custbody_nc_auto_config_origen',

        };

        /*
         * Protección contra una configuración accidentalmente excesiva.
         * Un cliente puede tener varias reglas, pero no más de este límite.
         */
        const CREDIT_MEMO_TYPE_REBAJA_VENTA = 9;
        const MAX_CONFIGURATIONS_PER_INVOICE = 20;

        function clearInheritedStampingData(creditMemo) {

        const fieldsToClear = [
        IDS.UUID,
        IDS.CFDI_XML_CERTIFICADO,
        IDS.CFDI_XML_GENERADO,
        IDS.CFDI_PDF
    ];

    fieldsToClear.forEach((fieldId) => {

        try {

            const oldValue = creditMemo.getValue({
                fieldId: fieldId
            });

            log.debug({
                title: 'Limpiando campo fiscal heredado',
                details: {
                    fieldId: fieldId,
                    previousValue: oldValue
                }
            });

            creditMemo.setValue({
                fieldId: fieldId,
                value: ''
            });

        } catch (error) {

            throw new Error(
                'No fue posible limpiar el campo ' +
                fieldId +
                '. Error: ' +
                error.message
            );
        }
    });
}
        function roundCurrency(value) {
            return Math.round(
                (Number(value) + Number.EPSILON) * 100
            ) / 100;
        }

        function parsePercentage(rawValue) {
            const normalized = String(rawValue || '')
                .trim()
                .replace(/\s/g, '')
                .replace('%', '')
                .replace(',', '.');

            const percentage = Number(normalized);

            if (
                !Number.isFinite(percentage) ||
                percentage <= 0
            ) {
                throw new Error(
                    `Porcentaje inválido: ${rawValue}`
                );
            }

            return {
                percentage,
                rate: percentage / 100
            };
        }

        function getConfigurations(customerId) {
            const configurations = [];

            const configSearch = search.create({
                type: IDS.CONFIG_RECORD,
                filters: [
                    ['isinactive', 'is', 'F'],
                    'AND',
                    [
                        IDS.CONFIG_CUSTOMER,
                        'anyof',
                        customerId
                    ]
                ],
                columns: [
                    search.createColumn({
                        name: 'internalid',
                        sort: search.Sort.ASC
                    }),
                    IDS.CONFIG_ITEM,
                    IDS.CONFIG_CONCEPT,
                    IDS.CONFIG_PERCENT
                ]
            });

            configSearch.run().each((result) => {
                const rawPercentage = result.getValue({
                    name: IDS.CONFIG_PERCENT
                });

                const parsedPercentage =
                    parsePercentage(rawPercentage);

                const itemId = result.getValue({
                    name: IDS.CONFIG_ITEM
                });

                if (!itemId) {
                    throw new Error(
                        `La configuración ${result.id} ` +
                        'no tiene artículo.'
                    );
                }

                configurations.push({
                    configId: result.id,

                    itemId,

                    itemText: result.getText({
                        name: IDS.CONFIG_ITEM
                    }),

                    concept: result.getValue({
                        name: IDS.CONFIG_CONCEPT
                    }),

                    rawPercentage,
                    percentage:
                        parsedPercentage.percentage,
                    rate: parsedPercentage.rate
                });

                return true;
            });

            return configurations;
        }

        function getAmount(transaction, fieldId) {
            try {
                const rawValue = transaction.getValue({
                    fieldId
                });

                const value = Number(rawValue);

                return Number.isFinite(value)
                    ? roundCurrency(value)
                    : null;

            } catch (error) {
                return null;
            }
        }

        function getInvoiceBalance(invoice) {
            const possibleFields = [
                'amountremaining',
                'amountremainingtotalbox'
            ];

            for (const fieldId of possibleFields) {
                const value = getAmount(
                    invoice,
                    fieldId
                );

                if (value !== null) {
                    return value;
                }
            }

            return null;
        }

        function removeOriginalItemLines(creditMemo) {
            const lineCount = creditMemo.getLineCount({
                sublistId: 'item'
            });

            for (
                let line = lineCount - 1;
                line >= 0;
                line--
            ) {
                creditMemo.removeLine({
                    sublistId: 'item',
                    line,
                    ignoreRecalc: false
                });
            }
        }

        function addConfiguredItem(
            creditMemo,
            configuration,
            baseAmount
        ) {
            creditMemo.selectNewLine({
                sublistId: 'item'
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'item',
                value: Number(configuration.itemId),
                forceSyncSourcing: true
            });

            /*
             * Precio personalizado.
             */
            try {
                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'price',
                    value: -1,
                    forceSyncSourcing: true
                });
            } catch (error) {
                log.debug({
                    title:
                        'No se modificó el nivel de precio',
                    details: {
                        configurationId:
                            configuration.configId,
                        message: error.message
                    }
                });
            }

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: 1
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'rate',
                value: baseAmount
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'amount',
                value: baseAmount
            });

            try {
                creditMemo.setCurrentSublistValue({
                    sublistId: 'item',
                    fieldId: 'description',
                    value:
                        configuration.concept ||
                        configuration.itemText ||
                        ''
                });
            } catch (error) {
                log.debug({
                    title:
                        'No se modificó la descripción',
                    details: {
                        configurationId:
                            configuration.configId,
                        message: error.message
                    }
                });
            }

            creditMemo.commitLine({
                sublistId: 'item',
                ignoreRecalc: false
            });
        }

        /**
         * Construye una Nota de Crédito en memoria.
         * No la guarda.
         */
        function buildCreditMemo(options) {
            const {
                invoiceId,
                invoiceNumber,
                invoiceSubtotal,
                configuration
            } = options;

            const baseAmount = roundCurrency(
                invoiceSubtotal * configuration.rate
            );

            if (baseAmount <= 0) {
                throw new Error(
                    `El importe calculado para la configuración ` +
                    `${configuration.configId} no es válido.`
                );
            }

            const creditMemo = record.transform({
                fromType: record.Type.INVOICE,
                fromId: invoiceId,
                toType: record.Type.CREDIT_MEMO,
                isDynamic: true
            });
            /**
             * Marcar check de autotimbrado
             */
            creditMemo.setValue({
                fieldId: 'custbody_efx_fe_autocertify',
                value: true
            });

            /**
             * Tipo de NC utilizado por EFX FE para determinar
             * la relacion CFDI durante el autotimbrado
             * 
             * 1 = REBAJA SOBRE LA VENTA
             */
            creditMemo.setValue({
                fieldId: IDS.CREDIT_MEMO_TYPE,
                value: CREDIT_MEMO_TYPE_REBAJA_VENTA
            });

            /*
            *La transaccion hereda algunos campos de la factura
            *Se elimina los documentos fiscales para qe la NC
            *Pueda generar su propio CFDI 
            */
                clearInheritedStampingData(creditMemo);


            creditMemo.setValue({
                fieldId:
                    IDS.CREDIT_CONFIG_ORIGIN,
                value: Number(configuration.configId)
            });

            creditMemo.setValue({
                fieldId: 'trandate',
                value: new Date()
            });

            creditMemo.setValue({
                fieldId: 'memo',
                value:
                    `NC automática - ` +
                    `${configuration.concept} - ` +
                    `Factura ${invoiceNumber}`
            });

            removeOriginalItemLines(creditMemo);

            addConfiguredItem(
                creditMemo,
                configuration,
                baseAmount
            );

            const subtotal = getAmount(
                creditMemo,
                'subtotal'
            );

            const taxTotal = getAmount(
                creditMemo,
                'taxtotal'
            );

            const total = getAmount(
                creditMemo,
                'total'
            );

            if (
                total === null ||
                total <= 0
            ) {
                throw new Error(
                    `NetSuite no calculó correctamente el ` +
                    `total para la configuración ` +
                    `${configuration.configId}.`
                );
            }

            return {
                record: creditMemo,
                configuration,
                baseAmount,
                subtotal,
                taxTotal,
                total,

                createdFrom: creditMemo.getValue({
                    fieldId: 'createdfrom'
                })
            };
        }

        function findInvoiceApplyLine(
            creditMemo,
            invoiceId
        ) {
            const lineCount = creditMemo.getLineCount({
                sublistId: 'apply'
            });

            for (
                let line = 0;
                line < lineCount;
                line++
            ) {
                const documentId =
                    creditMemo.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'doc',
                        line
                    });

                if (
                    String(documentId) ===
                    String(invoiceId)
                ) {
                    return line;
                }
            }

            return -1;
        }

        function applyOnlyToInvoice(
            creditMemo,
            invoiceId,
            amountToApply
        ) {
            const lineCount = creditMemo.getLineCount({
                sublistId: 'apply'
            });

            /*
             * Quita cualquier aplicación seleccionada
             * automáticamente durante la transformación.
             */
            for (
                let line = 0;
                line < lineCount;
                line++
            ) {
                creditMemo.selectLine({
                    sublistId: 'apply',
                    line
                });

                creditMemo.setCurrentSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    value: false
                });

                creditMemo.commitLine({
                    sublistId: 'apply',
                    ignoreRecalc: false
                });
            }

            const invoiceLine =
                findInvoiceApplyLine(
                    creditMemo,
                    invoiceId
                );

            if (invoiceLine < 0) {
                throw new Error(
                    'La factura de origen no aparece ' +
                    'en la sublista Aplicar.'
                );
            }

            creditMemo.selectLine({
                sublistId: 'apply',
                line: invoiceLine
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'apply',
                fieldId: 'apply',
                value: true
            });

            creditMemo.setCurrentSublistValue({
                sublistId: 'apply',
                fieldId: 'amount',
                value: amountToApply
            });

            creditMemo.commitLine({
                sublistId: 'apply',
                ignoreRecalc: false
            });
        }

        /**
         * Busca NC existentes para:
         * Factura + Configuración origen.
         */
        function findExistingCreditMemos(
            invoiceId,
            configurationId
        ) {
            const results = search.create({
                type: 'creditmemo',
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    [
                        'createdfrom',
                        'anyof',
                        invoiceId
                    ],
                    'AND',
                    [
                        IDS.CREDIT_CONFIG_ORIGIN,
                        'anyof',
                        configurationId
                    ]
                ],
                columns: [
                    'internalid',
                    'tranid'
                ]
            }).run().getRange({
                start: 0,
                end: 10
            });

            return (results || []).map((result) => ({
                id: result.getValue({
                    name: 'internalid'
                }),

                transactionNumber: result.getValue({
                    name: 'tranid'
                })
            }));
        }

        function verifySavedCreditMemo(
            creditMemoId,
            invoiceId
        ) {
            const savedCreditMemo = record.load({
                type: record.Type.CREDIT_MEMO,
                id: creditMemoId,
                isDynamic: false
            });

            const total = getAmount(
                savedCreditMemo,
                'total'
            );

            const subtotal = getAmount(
                savedCreditMemo,
                'subtotal'
            );

            const taxTotal = getAmount(
                savedCreditMemo,
                'taxtotal'
            );

            const applied = getAmount(
                savedCreditMemo,
                'applied'
            );

            const unapplied = getAmount(
                savedCreditMemo,
                'unapplied'
            );

            const createdFrom =
                savedCreditMemo.getValue({
                    fieldId: 'createdfrom'
                });

            const configurationOrigin =
                savedCreditMemo.getValue({
                    fieldId:
                        IDS.CREDIT_CONFIG_ORIGIN
                });

            const invoiceLine =
                findInvoiceApplyLine(
                    savedCreditMemo,
                    invoiceId
                );

            let invoiceApplied = false;
            let amountAppliedToInvoice = 0;

            if (invoiceLine >= 0) {
                invoiceApplied =
                    savedCreditMemo.getSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        line: invoiceLine
                    }) === true;

                amountAppliedToInvoice =
                    roundCurrency(
                        Number(
                            savedCreditMemo
                                .getSublistValue({
                                    sublistId: 'apply',
                                    fieldId: 'amount',
                                    line: invoiceLine
                                }) || 0
                        )
                    );
            }

            const appliedCorrectly =
                String(createdFrom) ===
                    String(invoiceId) &&
                invoiceApplied === true &&
                total !== null &&
                unapplied !== null &&
                Math.abs(unapplied) <= 0.01 &&
                Math.abs(
                    amountAppliedToInvoice - total
                ) <= 0.01;

            return {
                creditMemoId,

                transactionNumber:
                    savedCreditMemo.getValue({
                        fieldId: 'tranid'
                    }),

                createdFrom,
                configurationOrigin,

                subtotal,
                taxTotal,
                total,
                applied,
                unapplied,

                invoiceApplied,
                amountAppliedToInvoice,

                appliedCorrectly
            };
        }

        /**
         * Revisa si una regla ya tiene una NC válida.
         */
        function inspectExistingCreditMemo(
            invoiceId,
            configuration
        ) {
            const existing =
                findExistingCreditMemos(
                    invoiceId,
                    configuration.configId
                );

            if (existing.length > 1) {
                throw new Error(
                    `Existen ${existing.length} Notas de ` +
                    `Crédito para la factura y configuración ` +
                    `${configuration.configId}. ` +
                    'Se requiere revisión manual.'
                );
            }

            if (!existing.length) {
                return null;
            }

            const verification =
                verifySavedCreditMemo(
                    existing[0].id,
                    invoiceId
                );

            if (!verification.appliedCorrectly) {
                throw new Error(
                    `La NC ${existing[0].transactionNumber} ` +
                    `de la configuración ` +
                    `${configuration.configId} existe, pero ` +
                    'no está totalmente aplicada a la factura.'
                );
            }

            return verification;
        }

        function markInvoiceAsProcessed(invoiceId) {
            record.submitFields({
                type: record.Type.INVOICE,
                id: invoiceId,

                values: {
                    [IDS.PROCESSED]: true
                },

                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: false
                }
            });
        }

        function afterSubmit(context) {
            const allowedEvents = [
                context.UserEventType.CREATE,
                context.UserEventType.EDIT,
                context.UserEventType.XEDIT
            ];

            if (!allowedEvents.includes(context.type)) {
                return;
            }

            try {
                const invoiceId =
                    context.newRecord.id;

                if (!invoiceId) {
                    return;
                }

                const invoice = record.load({
                    type: record.Type.INVOICE,
                    id: invoiceId,
                    isDynamic: false
                });

                const invoiceNumber =
                    invoice.getValue({
                        fieldId: 'tranid'
                    });

                const uuid = String(
                    invoice.getValue({
                        fieldId: IDS.UUID
                    }) || ''
                ).trim();

                if (!uuid) {
                    log.audit({
                        title: 'Factura sin UUID',
                        details:
                            `Factura ${invoiceNumber}.`
                    });
                    return;
                }

                const alreadyProcessed =
                    invoice.getValue({
                        fieldId: IDS.PROCESSED
                    }) === true;

                if (alreadyProcessed) {
                    log.audit({
                        title: 'Factura ya procesada',
                        details:
                            `Factura ${invoiceNumber}.`
                    });
                    return;
                }

                const customerId =
                    invoice.getValue({
                        fieldId: 'entity'
                    });

                const customerText =
                    invoice.getText({
                        fieldId: 'entity'
                    });

                const invoiceSubtotal = Number(
                    invoice.getValue({
                        fieldId: 'subtotal'
                    })
                );

                const invoiceBalance =
                    getInvoiceBalance(invoice);

                if (!customerId) {
                    throw new Error(
                        'La factura no tiene cliente.'
                    );
                }

                if (
                    !Number.isFinite(invoiceSubtotal) ||
                    invoiceSubtotal <= 0
                ) {
                    throw new Error(
                        `Subtotal inválido: ` +
                        `${invoiceSubtotal}`
                    );
                }

                if (
                    invoiceBalance === null ||
                    invoiceBalance <= 0
                ) {
                    throw new Error(
                        `La factura no tiene saldo ` +
                        `disponible. Saldo: ` +
                        `${invoiceBalance}`
                    );
                }

                const configurations =
                    getConfigurations(customerId);

                if (!configurations.length) {
                    log.audit({
                        title:
                            'Cliente sin configuración de NC',
                        details: {
                            invoiceId,
                            invoiceNumber,
                            customerId,
                            customer: customerText
                        }
                    });
                    return;
                }

                if (
                    configurations.length >
                    MAX_CONFIGURATIONS_PER_INVOICE
                ) {
                    throw new Error(
                        `El cliente tiene ` +
                        `${configurations.length} ` +
                        `configuraciones activas. El máximo ` +
                        `permitido es ` +
                        `${MAX_CONFIGURATIONS_PER_INVOICE}.`
                    );
                }

                /*
                 * Divide las configuraciones entre:
                 * 1. NC ya existentes y válidas.
                 * 2. NC que todavía deben crearse.
                 */
                const existingCreditMemos = [];
                const pendingConfigurations = [];

                for (const configuration of configurations) {
                    const existing =
                        inspectExistingCreditMemo(
                            invoiceId,
                            configuration
                        );

                    if (existing) {
                        existingCreditMemos.push({
                            configurationId:
                                configuration.configId,
                            concept:
                                configuration.concept,
                            item:
                                configuration.itemText,
                            creditMemo: existing
                        });
                    } else {
                        pendingConfigurations.push(
                            configuration
                        );
                    }
                }

                /*
                 * Si todas ya existen correctamente, solamente
                 * se marca la factura como procesada.
                 */
                if (!pendingConfigurations.length) {
                    markInvoiceAsProcessed(invoiceId);

                    log.audit({
                        title:
                            'FACTURA COMPLETADA CON NC EXISTENTES',
                        details: JSON.stringify({
                            invoiceId,
                            invoiceNumber,
                            customerId,
                            customer: customerText,

                            configurations:
                                configurations.length,

                            existingCreditMemos,

                            invoiceMarkedAsProcessed: true
                        })
                    });

                    return;
                }

                /*
                 * PREVALIDACIÓN:
                 * construye todas las NC faltantes en memoria.
                 * Todavía no guarda ninguna.
                 */
                const previews =
                    pendingConfigurations.map(
                        (configuration) =>
                            buildCreditMemo({
                                invoiceId,
                                invoiceNumber,
                                invoiceSubtotal,
                                configuration
                            })
                    );

                const totalBasePending =
                    roundCurrency(
                        previews.reduce(
                            (total, preview) =>
                                total +
                                preview.baseAmount,
                            0
                        )
                    );

                const totalTaxPending =
                    roundCurrency(
                        previews.reduce(
                            (total, preview) =>
                                total +
                                (
                                    preview.taxTotal || 0
                                ),
                            0
                        )
                    );

                const totalCreditMemosPending =
                    roundCurrency(
                        previews.reduce(
                            (total, preview) =>
                                total +
                                preview.total,
                            0
                        )
                    );

                /*
                 * La factura debe cubrir todas las NC faltantes.
                 * Si no alcanza, no se guarda ninguna.
                 */
                if (
                    invoiceBalance <
                    totalCreditMemosPending
                ) {
                    throw new Error(
                        'Saldo insuficiente para crear todas ' +
                        'las Notas de Crédito. ' +
                        `Saldo factura: ${invoiceBalance}. ` +
                        `Total NC pendientes: ` +
                        `${totalCreditMemosPending}.`
                    );
                }

                log.audit({
                    title:
                        'PREVALIDACIÓN MULTI-NC APROBADA',
                    details: JSON.stringify({
                        invoiceId,
                        invoiceNumber,
                        customerId,
                        customer: customerText,

                        invoiceSubtotal,
                        invoiceBalance,

                        totalConfigurations:
                            configurations.length,

                        existingConfigurations:
                            existingCreditMemos.length,

                        pendingConfigurations:
                            pendingConfigurations.length,

                        totalBasePending,
                        totalTaxPending,
                        totalCreditMemosPending,

                        previews: previews.map(
                            (preview) => ({
                                configurationId:
                                    preview.configuration
                                        .configId,

                                concept:
                                    preview.configuration
                                        .concept,

                                itemId:
                                    preview.configuration
                                        .itemId,

                                item:
                                    preview.configuration
                                        .itemText,

                                percentage:
                                    preview.configuration
                                        .percentage,

                                baseAmount:
                                    preview.baseAmount,

                                taxTotal:
                                    preview.taxTotal,

                                total:
                                    preview.total
                            })
                        )
                    })
                });

                const createdCreditMemos = [];

                /*
                 * CREACIÓN:
                 * vuelve a construir cada NC para trabajar con
                 * el saldo actualizado después de cada guardado.
                 */
                for (
                    const configuration
                    of pendingConfigurations
                ) {
                    const liveInvoice = record.load({
                        type: record.Type.INVOICE,
                        id: invoiceId,
                        isDynamic: false
                    });

                    const currentBalance =
                        getInvoiceBalance(liveInvoice);

                    if (
                        currentBalance === null ||
                        currentBalance <= 0
                    ) {
                        throw new Error(
                            'No fue posible obtener el saldo ' +
                            'actualizado de la factura.'
                        );
                    }

                    const creditMemoData =
                        buildCreditMemo({
                            invoiceId,
                            invoiceNumber,
                            invoiceSubtotal,
                            configuration
                        });

                    if (
                        currentBalance <
                        creditMemoData.total
                    ) {
                        throw new Error(
                            `Saldo insuficiente al crear la NC ` +
                            `de ${configuration.concept}. ` +
                            `Saldo actual: ${currentBalance}. ` +
                            `Total NC: ${creditMemoData.total}.`
                        );
                    }

                    applyOnlyToInvoice(
                        creditMemoData.record,
                        invoiceId,
                        creditMemoData.total
                    );

                    /**
                     * Seguridad adicional:
                     * volvemos a lipiar los datos fiscales justo antes
                     * de guardar la nota de credito
                     */
                    clearInheritedStampingData (
                        creditMemoData.record
                    );

                    const creditMemoId =
                        creditMemoData.record.save({
                            enableSourcing: true,
                            ignoreMandatoryFields: false
                        });

                    const verification =
                        verifySavedCreditMemo(
                            creditMemoId,
                            invoiceId
                        );

                    if (!verification.appliedCorrectly) {
                        log.error({
                            title:
                                'NC creada, pero requiere revisión',
                            details: JSON.stringify({
                                invoiceId,
                                invoiceNumber,

                                configurationId:
                                    configuration.configId,

                                concept:
                                    configuration.concept,

                                item:
                                    configuration.itemText,

                                calculated:
                                    creditMemoData,

                                verification
                            })
                        });

                        /*
                         * No se marca la factura procesada.
                         * La búsqueda evitará que esta NC se
                         * duplique en una ejecución posterior.
                         */
                        return;
                    }

                    createdCreditMemos.push({
                        configurationId:
                            configuration.configId,

                        concept:
                            configuration.concept,

                        itemId:
                            configuration.itemId,

                        item:
                            configuration.itemText,

                        percentage:
                            configuration.percentage,

                        baseAmount:
                            creditMemoData.baseAmount,

                        calculatedTax:
                            creditMemoData.taxTotal,

                        calculatedTotal:
                            creditMemoData.total,

                        verification
                    });
                }

                /*
                 * Verificación final:
                 * todas las configuraciones deben tener
                 * exactamente una NC válida y aplicada.
                 */
                const finalVerification = [];

                for (const configuration of configurations) {
                    const verifiedCreditMemo =
                        inspectExistingCreditMemo(
                            invoiceId,
                            configuration
                        );

                    if (!verifiedCreditMemo) {
                        throw new Error(
                            `No se encontró la NC final para ` +
                            `la configuración ` +
                            `${configuration.configId}.`
                        );
                    }

                    finalVerification.push({
                        configurationId:
                            configuration.configId,

                        concept:
                            configuration.concept,

                        item:
                            configuration.itemText,

                        creditMemo:
                            verifiedCreditMemo
                    });
                }

                markInvoiceAsProcessed(invoiceId);

                log.audit({
                    title:
                        'NC AUTOMÁTICAS CREADAS Y APLICADAS',
                    details: JSON.stringify({
                        invoiceId,
                        invoiceNumber,
                        customerId,
                        customer: customerText,

                        invoiceSubtotal,
                        originalInvoiceBalance:
                            invoiceBalance,

                        numberOfConfigurations:
                            configurations.length,

                        existingCreditMemos,
                        createdCreditMemos,
                        finalVerification,

                        invoiceMarkedAsProcessed: true
                    })
                });

            } catch (error) {
                log.error({
                    title:
                        'Error creación múltiple de NC',
                    details: {
                        name: error.name,
                        message: error.message,
                        stack: error.stack
                    }
                });
            }
        }

        return {
            afterSubmit
        };
    }
);
