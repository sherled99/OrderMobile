import {
    BaseRequest,
    BaseRequestHandler,
    ColumnExpression,
    ComparisonType,
    CompareFilter,
    CrtModule,
    CrtRequestHandler,
    DoBootstrap,
    HandleViewModelAttributeChangeRequest,
    LoadDataRequest,
    Model,
    ModelParameterType,
    ParameterExpression,
    bootstrapCrtModule
} from '@creatio/mobile-common';

const ORDER_MOBILE_PAGE = 'UsrOrderMobileEditPage';
const ORDER_PRODUCT_MOBILE_PAGE = 'UsrOrderProductMobileEditPage';
const ORDER_CONTRACT_ATTRIBUTE = 'OrderDS_UsrContract_k0jq8wn';
const ORDER_CURRENCY_ATTRIBUTE = 'OrderDS_Currency_bpgbf8n';
const debugLog = (...args: unknown[]): void => {
    (globalThis as { console?: { log: (...items: unknown[]) => void } }).console?.log(...args);
};

type LookupLike =
    | string
    | {
        value?: string;
        Value?: string;
        id?: string;
        Id?: string;
    }
    | null
    | undefined;

@CrtRequestHandler({
    requestType: 'crt.LoadDataRequest',
    type: 'glb.OrderMobileFieldsStateHandler',
    scopes: [ORDER_MOBILE_PAGE]
})
export class OrderMobileFieldsStateHandler extends BaseRequestHandler<LoadDataRequest> {
    public async handle(request: LoadDataRequest): Promise<unknown> {
        const result = await this.next?.handle(request);
        const cardState = await request.$context['CardState'] as string;

        if (cardState !== 'add') {
            await request.$context.setAttributePropertyValue('OrderDS_Account_5ohaihw', 'readonly', true);
            await request.$context.setAttributePropertyValue('OrderDS_UsrContract_k0jq8wn', 'readonly', true);
            await request.$context.setAttributePropertyValue('OrderDS_UsrCloseDate_g8gnhee', 'readonly', true);
            debugLog(`[UsrMobile] Account, UsrContract, UsrCloseDate set to readonly for CardState: ${cardState}`);
        }

        return result;
    }
}

@CrtRequestHandler({
    requestType: 'crt.LoadDataRequest',
    type: 'glb.OrderProductMobileFieldsStateHandler',
    scopes: [ORDER_PRODUCT_MOBILE_PAGE]
})
export class OrderProductMobileFieldsStateHandler extends BaseRequestHandler<LoadDataRequest> {
    public async handle(request: LoadDataRequest): Promise<unknown> {
        const result = await this.next?.handle(request);
        const cardState = await request.$context['CardState'] as string;

        if (cardState !== 'add') {
            await request.$context.setAttributePropertyValue('OrderProductDS_Product_hg2hy0q', 'readonly', true);
            debugLog(`[UsrMobile] Product set to readonly for CardState: ${cardState}`);
        }

        return result;
    }
}

@CrtRequestHandler({
    requestType: 'crt.SaveRecordRequest',
    type: 'glb.CustomLoadDataRequestHandler',
    scopes: [ORDER_MOBILE_PAGE]
})
export class GlbCustomLoadDataRequestHandler extends BaseRequestHandler {
    public async handle(request: BaseRequest): Promise<unknown> {
        const cardState = await request.$context['CardState'] as string;
        debugLog(`[UsrMobile] SaveRecordRequest. CardState: ${cardState}`);

        if (cardState === 'add') {
            await request.$context.setAttribute('UsrMobile', true);
            debugLog('[UsrMobile] UsrMobile set to true');
        }

        return await this.next?.handle(request);
    }
}

@CrtRequestHandler({
    requestType: 'crt.HandleViewModelAttributeChangeRequest',
    type: 'glb.OrderCurrencyByContractChangeHandler',
    scopes: [ORDER_MOBILE_PAGE]
})
export class OrderCurrencyByContractChangeHandler extends BaseRequestHandler<HandleViewModelAttributeChangeRequest> {
    public async handle(request: HandleViewModelAttributeChangeRequest): Promise<unknown> {
        const result = await this.next?.handle(request);

        if (request.attributeName !== ORDER_CONTRACT_ATTRIBUTE) {
            return result;
        }

        debugLog(
            `[UsrMobile] Contract change detected. ` +
            `attribute=${request.attributeName}, ` +
            `value=${this.stringifyValue(request.value)}, ` +
            `oldValue=${this.stringifyValue(request.oldValue)}`
        );

        const contractId = this.extractLookupId(request.value);
        debugLog(`[UsrMobile] Extracted contractId=${contractId ?? 'n/a'} from request.value`);

        if (!contractId) {
            await request.$context.setAttribute(ORDER_CURRENCY_ATTRIBUTE, null);
            debugLog('[UsrMobile] Currency cleared because contract is empty');
            return result;
        }

        const currencyValue = await this.loadCurrencyByContractId(contractId);
        debugLog(
            `[UsrMobile] Currency value loaded from contract. raw=${this.stringifyValue(currencyValue)}, ` +
            `currencyId=${this.extractLookupId(currencyValue) ?? 'n/a'}`
        );

        await request.$context.setAttribute(ORDER_CURRENCY_ATTRIBUTE, currencyValue ?? null);
        const updatedCurrencyValue = await this.getContextAttributeValue(request.$context, ORDER_CURRENCY_ATTRIBUTE);
        debugLog(
            `[UsrMobile] Currency synced from contract change. ` +
            `contractId=${contractId}, ` +
            `currencyId=${this.extractLookupId(currencyValue) ?? 'n/a'}, ` +
            `contextValue=${this.stringifyValue(updatedCurrencyValue)}, ` +
            `contextCurrencyId=${this.extractLookupId(updatedCurrencyValue) ?? 'n/a'}`
        );

        return result;
    }

    private async loadCurrencyByContractId(contractId: string): Promise<unknown> {
        const contractModel = await Model.create('Contract');
        const contracts = await contractModel.load({
            attributes: [
                { name: 'UsrPricelist', path: 'UsrPricelist' },
                { name: 'UsrProductCurrency', path: 'UsrPricelist.UsrProductCurrency' }
            ],
            parameters: [{
                type: ModelParameterType.Filter,
                value: new CompareFilter(
                    ComparisonType.Equal,
                    new ColumnExpression({ columnPath: 'Id' }),
                    new ParameterExpression({ value: contractId })
                )
            }]
        }) as Array<{ UsrPricelist?: unknown; UsrProductCurrency?: unknown }>;

        debugLog(
            `[UsrMobile] Contract load result. ` +
            `contractId=${contractId}, rows=${contracts?.length ?? 0}, ` +
            `firstRow=${this.stringifyValue(contracts?.[0] ?? null)}`
        );

        const firstRow = contracts?.[0] as { UsrPricelist?: unknown; UsrProductCurrency?: unknown } | undefined;
        const rawCurrencyValue =
            this.getNestedLookupValue(firstRow?.UsrPricelist, 'UsrProductCurrency') ??
            firstRow?.UsrProductCurrency ??
            null;

        const normalizedCurrencyValue = this.normalizeLookupValue(rawCurrencyValue);
        debugLog(
            `[UsrMobile] Normalized currency value. ` +
            `raw=${this.stringifyValue(rawCurrencyValue)}, ` +
            `normalized=${this.stringifyValue(normalizedCurrencyValue)}`
        );

        return normalizedCurrencyValue;
    }

    private async getContextAttributeValue(
        context: BaseRequest['$context'],
        attributeName: string
    ): Promise<unknown> {
        try {
            if (typeof context.getAttribute === 'function') {
                return await context.getAttribute(attributeName);
            }
        } catch {
            // Ignore getAttribute failures and try direct access.
        }

        try {
            return await context[attributeName];
        } catch {
            return undefined;
        }
    }

    private extractLookupId(value: unknown): string | undefined {
        if (!value) {
            return undefined;
        }

        if (typeof value === 'string') {
            return value;
        }

        if (typeof value !== 'object') {
            return undefined;
        }

        const lookupValue = value as Exclude<LookupLike, string | null | undefined>;

        return lookupValue?.value ?? lookupValue?.Value ?? lookupValue?.id ?? lookupValue?.Id;
    }

    private extractLookupDisplayValue(value: unknown): string | undefined {
        if (!value || typeof value !== 'object') {
            return undefined;
        }

        const lookupValue = value as {
            displayValue?: string;
            DisplayValue?: string;
            name?: string;
            Name?: string;
            shortName?: string;
            ShortName?: string;
        };

        return lookupValue.displayValue
            ?? lookupValue.DisplayValue
            ?? lookupValue.name
            ?? lookupValue.Name
            ?? lookupValue.shortName
            ?? lookupValue.ShortName;
    }

    private getNestedLookupValue(value: unknown, propertyName: string): unknown {
        if (!value || typeof value !== 'object') {
            return undefined;
        }

        return (value as Record<string, unknown>)[propertyName];
    }

    private normalizeLookupValue(value: unknown): unknown {
        const id = this.extractLookupId(value);

        if (!id) {
            return null;
        }

        const displayValue = this.extractLookupDisplayValue(value) ?? id;

        return {
            value: id,
            displayValue
        };
    }

    private stringifyValue(value: unknown): string {
        try {
            if (typeof value === 'string') {
                return value;
            }

            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
}

@CrtModule({
    requestHandlers: [
        OrderMobileFieldsStateHandler,
        GlbCustomLoadDataRequestHandler,
        OrderCurrencyByContractChangeHandler,
        OrderProductMobileFieldsStateHandler
    ]
})
export class OrderMobileDefaultsModule implements DoBootstrap {
    public bootstrap(): void {
        bootstrapCrtModule('OrderMobileDefaultsModule', OrderMobileDefaultsModule);
    }
}
