import {
    BaseRequest,
    BaseRequestHandler,
    ColumnExpression,
    ComparisonType,
    CompareFilter,
    CrtModule,
    CrtRequestHandler,
    DataValueType,
    DoBootstrap,
    FilterGroup,
    FilterType,
    HandlerChainService,
    HandleViewModelAttributeChangeRequest,
    LoadDataRequest,
    LogicalOperatorType,
    Model,
    ModelParameterType,
    ParameterExpression,
    bootstrapCrtModule
} from '@creatio/mobile-common';

const ORDER_MOBILE_PAGE = 'UsrOrderMobileEditPage';
const ORDER_PRODUCT_MOBILE_PAGE = 'UsrOrderProductMobileEditPage';
const SAVE_ORDER_AND_CREATE_ORDER_PRODUCT_REQUEST = 'SaveOrderAndCreateOrderProduct';
const ORDER_ID_ATTRIBUTE = 'Id';
const ORDER_ACCOUNT_ATTRIBUTE = 'OrderDS_Account_5ohaihw';
const ORDER_CONTRACT_ATTRIBUTE = 'OrderDS_UsrContract_k0jq8wn';
const ORDER_CURRENCY_ATTRIBUTE = 'OrderDS_Currency_bpgbf8n';
const ORDER_ADDITIONAL_INVOICE_CURRENCY_ATTRIBUTE = 'OrderDS_UsrAdditionalInvoiceCurrency_8tw6te5';
const ORDER_ADDITIONAL_INVOICE_CURRENCY_EXCHANGE_RATE_ATTRIBUTE =
    'OrderDS_UsrAdditionalInvoiceCurrencyExchangeRate_4iea63x';
const ORDER_OUR_COMPANY_ATTRIBUTE = 'OrderDS_UsrOurCompany_ni182th';
const ORDER_OUR_COMPANY_BILLING_INFO_ATTRIBUTE = 'OrderDS_UsrOurCompanyBillingInfo_pgqmvua';
const ORDER_OWNER_ATTRIBUTE = 'OrderDS_Owner_eifsnwo';
const ORDER_MARKETING_OWNER_ATTRIBUTE = 'OrderDS_UsrMarketingOwner_cp2l7yl';
const ORDER_SALES_OWNER_ATTRIBUTE = 'OrderDS_UsrSalesOwner_a91fe07';
const ORDER_PRODUCT_PRODUCT_ATTRIBUTE = 'OrderProductDS_Product_hg2hy0q';
const ORDER_PRODUCT_UNIT_ATTRIBUTE = 'OrderProductDS_Unit_4h3l9ww';
const ORDER_PRODUCT_ORDER_ATTRIBUTE = 'OrderProductDS_Order';
const ORDER_PRODUCT_PRODUCT_BUSINESS_RULE_FILTER_ATTRIBUTE =
    `${ORDER_PRODUCT_PRODUCT_ATTRIBUTE}_List_BusinessRule_Filter`;
const ORDER_PRODUCT_CUSTOMER_PRODUCT_ATTRIBUTE = 'UsrCustomerProduct';
const ORDER_PRODUCT_PRICE_FILTER_KEY = '4fa2fdd6-87be-4f71-9b1d-0fda6b694c7d';
const debugLog = (...args: unknown[]): void => {
    (globalThis as { console?: { log: (...items: unknown[]) => void } }).console?.log(...args);
};
let orderProductLastAppliedPriceComparisonType: ComparisonType | undefined;

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

type ProductPriceFilter = {
    key?: string;
    comparisonType?: ComparisonType;
    rightExpression?: {
        parameter?: {
            value?: unknown;
        };
    };
};

type AccountOwnerValues = {
    Owner?: unknown;
    UsrMarketingOwner?: unknown;
    UsrSalesOwner?: unknown;
};

type ContractDefaultValues = {
    UsrPricelist?: unknown;
    UsrProductCurrency?: unknown;
    UsrAdditionalInvoiceCurrency?: unknown;
    UsrAdditionalInvoiceCurrencyExchangeRate?: unknown;
    OurCompany?: unknown;
    SupplierBillingInfo?: unknown;
};

type UnitLoadResult = {
    source: 'UsrAccountProduct' | 'Product' | 'none';
    value: unknown;
};

async function applyOrderProductPriceFilter(
    context: BaseRequest['$context'],
    customerProductValue?: unknown
): Promise<void> {
    const resolvedCustomerProductValue = customerProductValue === undefined
        ? await getContextAttributeValue(context, ORDER_PRODUCT_CUSTOMER_PRODUCT_ATTRIBUTE)
        : customerProductValue;
    const customerProduct = toBoolean(resolvedCustomerProductValue);
    const comparisonType = customerProduct ? ComparisonType.Greater : ComparisonType.Equal;
    const currentFilter = await getContextAttributeValue(
        context,
        ORDER_PRODUCT_PRODUCT_BUSINESS_RULE_FILTER_ATTRIBUTE
    ) as ProductPriceFilter | undefined;

    if (
        isSameProductPriceFilter(currentFilter, comparisonType) ||
        orderProductLastAppliedPriceComparisonType === comparisonType
    ) {
        return;
    }

    orderProductLastAppliedPriceComparisonType = comparisonType;
    await context.setAttribute(
        ORDER_PRODUCT_PRODUCT_BUSINESS_RULE_FILTER_ATTRIBUTE,
        createProductPriceFilter(comparisonType)
    );
    debugLog(
        `[UsrMobile] Product lookup business rule filter applied. ` +
        `attribute=${ORDER_PRODUCT_PRODUCT_BUSINESS_RULE_FILTER_ATTRIBUTE}, ` +
        `customerProduct=${customerProduct}, condition=Price ${customerProduct ? '>' : '='} 0`
    );
}

function createProductPriceFilter(comparisonType: ComparisonType): ProductPriceFilter {
    return {
        filterType: FilterType.Compare,
        comparisonType,
        isEnabled: true,
        trimDateTimeParameterToDate: false,
        leftExpression: {
            expressionType: 0,
            columnPath: 'Price'
        },
        rightExpression: {
            expressionType: 2,
            parameter: {
                dataValueType: DataValueType.Money,
                value: 0
            }
        },
        isAggregative: false,
        key: ORDER_PRODUCT_PRICE_FILTER_KEY
    } as ProductPriceFilter;
}

function isSameProductPriceFilter(
    filter: ProductPriceFilter | undefined,
    comparisonType: ComparisonType
): boolean {
    return filter?.key === ORDER_PRODUCT_PRICE_FILTER_KEY
        && Number(filter.comparisonType) === comparisonType
        && Number(filter.rightExpression?.parameter?.value) === 0;
}

async function getContextAttributeValue(
    context: BaseRequest['$context'],
    attributeName: string
): Promise<unknown> {
    try {
        if (typeof context.getAttribute === 'function') {
            const value = await context.getAttribute(attributeName);
            if (value !== undefined) {
                return value;
            }
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

function toBoolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1;
}

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
            await request.$context.setAttributePropertyValue(ORDER_ACCOUNT_ATTRIBUTE, 'readonly', true);
            await request.$context.setAttributePropertyValue(ORDER_CONTRACT_ATTRIBUTE, 'readonly', true);
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
            await request.$context.setAttributePropertyValue(ORDER_PRODUCT_PRODUCT_ATTRIBUTE, 'readonly', true);
            debugLog(`[UsrMobile] Product set to readonly for CardState: ${cardState}`);
        }

        return result;
    }
}

@CrtRequestHandler({
    requestType: 'crt.LoadDataRequest',
    type: 'glb.OrderProductPriceFilterHandler',
    scopes: [ORDER_PRODUCT_MOBILE_PAGE]
})
export class OrderProductPriceFilterHandler extends BaseRequestHandler<LoadDataRequest> {
    public async handle(request: LoadDataRequest): Promise<unknown> {
        await applyOrderProductPriceFilter(request.$context);

        return this.next?.handle(request);
    }
}

@CrtRequestHandler({
    requestType: 'crt.HandleViewModelAttributeChangeRequest',
    type: 'glb.OrderProductCustomerProductPriceFilterHandler',
    scopes: [ORDER_PRODUCT_MOBILE_PAGE]
})
export class OrderProductCustomerProductPriceFilterHandler extends BaseRequestHandler<HandleViewModelAttributeChangeRequest> {
    public async handle(request: HandleViewModelAttributeChangeRequest): Promise<unknown> {
        const result = await this.next?.handle(request);

        if (request.attributeName === ORDER_PRODUCT_CUSTOMER_PRODUCT_ATTRIBUTE) {
            await applyOrderProductPriceFilter(request.$context, request.value);
        }

        return result;
    }
}

@CrtRequestHandler({
    requestType: 'crt.HandleViewModelAttributeChangeRequest',
    type: 'glb.OrderProductUnitByProductChangeHandler',
    scopes: [ORDER_PRODUCT_MOBILE_PAGE]
})
export class OrderProductUnitByProductChangeHandler extends BaseRequestHandler<HandleViewModelAttributeChangeRequest> {
    public async handle(request: HandleViewModelAttributeChangeRequest): Promise<unknown> {
        const result = await this.next?.handle(request);

        if (request.attributeName !== ORDER_PRODUCT_PRODUCT_ATTRIBUTE) {
            return result;
        }

        const productId = this.extractLookupId(request.value);
        debugLog(`[UsrMobile] Order product Product change detected. productId=${productId ?? 'n/a'}`);

        if (!productId) {
            await request.$context.setAttribute(ORDER_PRODUCT_UNIT_ATTRIBUTE, null);
            debugLog('[UsrMobile] Order product Unit cleared because Product is empty');
            return result;
        }

        const accountId = await this.getOrderAccountId(request.$context);
        const unitResult = await this.loadUnit(productId, accountId);
        await request.$context.setAttribute(ORDER_PRODUCT_UNIT_ATTRIBUTE, this.normalizeLookupValue(unitResult.value));
        debugLog(
            `[UsrMobile] Order product Unit synced from Product change. ` +
            `productId=${productId}, accountId=${accountId ?? 'n/a'}, ` +
            `source=${unitResult.source}, unitId=${this.extractLookupId(unitResult.value) ?? 'n/a'}`
        );

        return result;
    }

    private async getOrderAccountId(context: BaseRequest['$context']): Promise<string | undefined> {
        const orderId = await this.getOrderId(context);

        if (!orderId) {
            debugLog(`[UsrMobile] Order product Unit: ${ORDER_PRODUCT_ORDER_ATTRIBUTE} not found in detail context`);
            return undefined;
        }

        return this.loadAccountIdByOrderId(orderId);
    }

    private async getOrderId(context: BaseRequest['$context']): Promise<string | undefined> {
        const value = await getContextAttributeValue(context, ORDER_PRODUCT_ORDER_ATTRIBUTE);
        const orderId = this.extractLookupId(value);

        if (orderId) {
            debugLog(
                `[UsrMobile] Order product Unit: orderId resolved from ${ORDER_PRODUCT_ORDER_ATTRIBUTE}. ` +
                `orderId=${orderId}`
            );
        }

        return orderId;
    }

    private async loadAccountIdByOrderId(orderId: string): Promise<string | undefined> {
        const orderModel = await Model.create('Order');
        const orders = await orderModel.load({
            attributes: [
                { name: 'Account', path: 'Account' }
            ],
            parameters: [{
                type: ModelParameterType.Filter,
                value: new CompareFilter(
                    ComparisonType.Equal,
                    new ColumnExpression({ columnPath: 'Id' }),
                    new ParameterExpression({ value: orderId })
                )
            }]
        }) as Array<{ Account?: unknown }>;

        return this.extractLookupId(orders?.[0]?.Account);
    }

    private async loadUnit(productId: string, accountId: string | undefined): Promise<UnitLoadResult> {
        if (accountId) {
            const accountProductUnit = await this.loadAccountProductUnit(productId, accountId);

            if (this.extractLookupId(accountProductUnit)) {
                return {
                    source: 'UsrAccountProduct',
                    value: accountProductUnit
                };
            }
        }

        return {
            source: 'Product',
            value: await this.loadProductUnit(productId)
        };
    }

    private async loadAccountProductUnit(productId: string, accountId: string): Promise<unknown> {
        const accountProductModel = await Model.create('UsrAccountProduct');
        const filter = new FilterGroup(LogicalOperatorType.And);
        filter.addSchemaColumnFilterWithParameter(ComparisonType.Equal, 'UsrAccount', accountId);
        filter.addSchemaColumnFilterWithParameter(ComparisonType.Equal, 'UsrProduct', productId);
        filter.addSchemaColumnFilterWithParameter(ComparisonType.Equal, 'RecordInactive', false);
        filter.addSchemaColumnFilterWithParameter(ComparisonType.Equal, 'UsrDefault', true);

        const accountProducts = await accountProductModel.load({
            attributes: [
                { name: 'UsrUnit', path: 'UsrUnit' }
            ],
            parameters: [{
                type: ModelParameterType.Filter,
                value: filter
            }]
        }) as Array<{ UsrUnit?: unknown }>;

        return accountProducts?.[0]?.UsrUnit ?? null;
    }

    private async loadProductUnit(productId: string): Promise<unknown> {
        const productModel = await Model.create('Product');
        const products = await productModel.load({
            attributes: [
                { name: 'Unit', path: 'Unit' }
            ],
            parameters: [{
                type: ModelParameterType.Filter,
                value: new CompareFilter(
                    ComparisonType.Equal,
                    new ColumnExpression({ columnPath: 'Id' }),
                    new ParameterExpression({ value: productId })
                )
            }]
        }) as Array<{ Unit?: unknown }>;

        return products?.[0]?.Unit ?? null;
    }

    private normalizeLookupValue(value: unknown): unknown {
        const id = this.extractLookupId(value);

        if (!id) {
            return null;
        }

        return {
            value: id,
            displayValue: this.extractLookupDisplayValue(value) ?? id
        };
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
    requestType: SAVE_ORDER_AND_CREATE_ORDER_PRODUCT_REQUEST,
    type: 'glb.SaveOrderAndCreateOrderProductHandler',
    scopes: [ORDER_MOBILE_PAGE]
})
export class SaveOrderAndCreateOrderProductHandler extends BaseRequestHandler<BaseRequest> {
    public async handle(request: BaseRequest): Promise<unknown> {
        debugLog('[UsrMobile] SaveOrderAndCreateOrderProduct started');

        const saveResult = await HandlerChainService.instance.process({
            type: 'crt.SaveRecordRequest',
            $context: request.$context,
            scopes: [ORDER_MOBILE_PAGE]
        } as BaseRequest);

        if (this.isFailedSaveResult(saveResult)) {
            debugLog(
                `[UsrMobile] SaveOrderAndCreateOrderProduct stopped because save failed. ` +
                `result=${this.stringifyValue(saveResult)}`
            );
            return saveResult;
        }

        const orderId = this.extractLookupId(await getContextAttributeValue(request.$context, ORDER_ID_ATTRIBUTE));

        if (!orderId) {
            debugLog('[UsrMobile] SaveOrderAndCreateOrderProduct stopped because Order Id was not resolved');
            return saveResult;
        }

        debugLog(`[UsrMobile] Order saved. Opening OrderProduct create page. orderId=${orderId}`);

        return HandlerChainService.instance.process({
            type: 'crt.CreateRecordRequest',
            $context: request.$context,
            scopes: [ORDER_MOBILE_PAGE],
            entityName: 'OrderProduct',
            defaultValues: [{
                attributeName: 'Order',
                value: orderId
            }]
        } as BaseRequest & {
            entityName: string;
            defaultValues: Array<{
                attributeName: string;
                value: unknown;
            }>;
        });
    }

    private isFailedSaveResult(result: unknown): boolean {
        if (result === false) {
            return true;
        }

        if (!result || typeof result !== 'object' || !('success' in result)) {
            return false;
        }

        return (result as { success?: boolean }).success === false;
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

@CrtRequestHandler({
    requestType: 'crt.HandleViewModelAttributeChangeRequest',
    type: 'glb.OrderOwnersByAccountChangeHandler',
    scopes: [ORDER_MOBILE_PAGE]
})
export class OrderOwnersByAccountChangeHandler extends BaseRequestHandler<HandleViewModelAttributeChangeRequest> {
    public async handle(request: HandleViewModelAttributeChangeRequest): Promise<unknown> {
        const result = await this.next?.handle(request);

        if (request.attributeName !== ORDER_ACCOUNT_ATTRIBUTE) {
            return result;
        }

        const accountId = this.extractLookupId(request.value);
        debugLog(`[UsrMobile] Account change detected. accountId=${accountId ?? 'n/a'}`);

        if (!accountId) {
            await this.setOwnerFields(request, {});
            debugLog('[UsrMobile] Owner fields cleared because account is empty');
            return result;
        }

        const ownerValues = await this.loadOwnerValuesByAccountId(accountId);
        await this.setOwnerFields(request, ownerValues);
        debugLog(
            `[UsrMobile] Owner fields synced from account. ` +
            `accountId=${accountId}, ` +
            `ownerId=${this.extractLookupId(ownerValues.Owner) ?? 'n/a'}, ` +
            `marketingOwnerId=${this.extractLookupId(ownerValues.UsrMarketingOwner) ?? 'n/a'}, ` +
            `salesOwnerId=${this.extractLookupId(ownerValues.UsrSalesOwner) ?? 'n/a'}`
        );

        return result;
    }

    private async loadOwnerValuesByAccountId(accountId: string): Promise<AccountOwnerValues> {
        const accountModel = await Model.create('Account');
        const accounts = await accountModel.load({
            attributes: [
                { name: 'Owner', path: 'Owner' },
                { name: 'UsrMarketingOwner', path: 'UsrMarketingOwner' },
                { name: 'UsrSalesOwner', path: 'UsrSalesOwner' }
            ],
            parameters: [{
                type: ModelParameterType.Filter,
                value: new CompareFilter(
                    ComparisonType.Equal,
                    new ColumnExpression({ columnPath: 'Id' }),
                    new ParameterExpression({ value: accountId })
                )
            }]
        }) as AccountOwnerValues[];

        return accounts?.[0] ?? {};
    }

    private async setOwnerFields(
        request: HandleViewModelAttributeChangeRequest,
        ownerValues: AccountOwnerValues
    ): Promise<void> {
        await request.$context.setAttribute(ORDER_OWNER_ATTRIBUTE, this.normalizeLookupValue(ownerValues.Owner));
        await request.$context.setAttribute(
            ORDER_MARKETING_OWNER_ATTRIBUTE,
            this.normalizeLookupValue(ownerValues.UsrMarketingOwner)
        );
        await request.$context.setAttribute(
            ORDER_SALES_OWNER_ATTRIBUTE,
            this.normalizeLookupValue(ownerValues.UsrSalesOwner)
        );
    }

    private normalizeLookupValue(value: unknown): unknown {
        const id = this.extractLookupId(value);

        if (!id) {
            return null;
        }

        return {
            value: id,
            displayValue: this.extractLookupDisplayValue(value) ?? id
        };
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
}

@CrtRequestHandler({
    requestType: 'crt.HandleViewModelAttributeChangeRequest',
    type: 'glb.OrderDefaultsByContractChangeHandler',
    scopes: [ORDER_MOBILE_PAGE]
})
export class OrderDefaultsByContractChangeHandler extends BaseRequestHandler<HandleViewModelAttributeChangeRequest> {
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
            await this.setContractDefaultFields(request, {});
            debugLog('[UsrMobile] Contract default fields cleared because contract is empty');
            return result;
        }

        const contractValues = await this.loadContractDefaultValuesByContractId(contractId);
        const currencyValue = this.getCurrencyValue(contractValues);
        await this.setContractDefaultFields(request, contractValues, currencyValue);
        debugLog(
            `[UsrMobile] Contract default fields synced from contract change. ` +
            `contractId=${contractId}, ` +
            `currencyId=${this.extractLookupId(currencyValue) ?? 'n/a'}, ` +
            `additionalInvoiceCurrencyId=` +
            `${this.extractLookupId(contractValues.UsrAdditionalInvoiceCurrency) ?? 'n/a'}, ` +
            `additionalInvoiceCurrencyExchangeRate=` +
            `${this.stringifyValue(contractValues.UsrAdditionalInvoiceCurrencyExchangeRate ?? null)}, ` +
            `ourCompanyId=${this.extractLookupId(contractValues.OurCompany) ?? 'n/a'}, ` +
            `ourCompanyBillingInfoId=${this.extractLookupId(contractValues.SupplierBillingInfo) ?? 'n/a'}`
        );

        return result;
    }

    private async loadContractDefaultValuesByContractId(contractId: string): Promise<ContractDefaultValues> {
        const contractModel = await Model.create('Contract');
        const contracts = await contractModel.load({
            attributes: [
                { name: 'UsrPricelist', path: 'UsrPricelist' },
                { name: 'UsrProductCurrency', path: 'UsrPricelist.UsrProductCurrency' },
                { name: 'UsrAdditionalInvoiceCurrency', path: 'UsrAdditionalInvoiceCurrency' },
                {
                    name: 'UsrAdditionalInvoiceCurrencyExchangeRate',
                    path: 'UsrAdditionalInvoiceCurrencyExchangeRate'
                },
                { name: 'OurCompany', path: 'OurCompany' },
                { name: 'SupplierBillingInfo', path: 'SupplierBillingInfo' }
            ],
            parameters: [{
                type: ModelParameterType.Filter,
                value: new CompareFilter(
                    ComparisonType.Equal,
                    new ColumnExpression({ columnPath: 'Id' }),
                    new ParameterExpression({ value: contractId })
                )
            }]
        }) as ContractDefaultValues[];

        debugLog(
            `[UsrMobile] Contract load result. ` +
            `contractId=${contractId}, rows=${contracts?.length ?? 0}, ` +
            `firstRow=${this.stringifyValue(contracts?.[0] ?? null)}`
        );

        return contracts?.[0] ?? {};
    }

    private async setContractDefaultFields(
        request: HandleViewModelAttributeChangeRequest,
        contractValues: ContractDefaultValues,
        currencyValue: unknown = this.getCurrencyValue(contractValues)
    ): Promise<void> {
        await request.$context.setAttribute(
            ORDER_CURRENCY_ATTRIBUTE,
            this.normalizeLookupValue(currencyValue)
        );
        await request.$context.setAttribute(
            ORDER_ADDITIONAL_INVOICE_CURRENCY_ATTRIBUTE,
            this.normalizeLookupValue(contractValues.UsrAdditionalInvoiceCurrency)
        );
        await request.$context.setAttribute(
            ORDER_ADDITIONAL_INVOICE_CURRENCY_EXCHANGE_RATE_ATTRIBUTE,
            contractValues.UsrAdditionalInvoiceCurrencyExchangeRate ?? null
        );
        await request.$context.setAttribute(
            ORDER_OUR_COMPANY_ATTRIBUTE,
            this.normalizeLookupValue(contractValues.OurCompany)
        );
        await request.$context.setAttribute(
            ORDER_OUR_COMPANY_BILLING_INFO_ATTRIBUTE,
            this.normalizeLookupValue(contractValues.SupplierBillingInfo)
        );
    }

    private getCurrencyValue(contractValues: ContractDefaultValues): unknown {
        return (
            this.getNestedLookupValue(contractValues.UsrPricelist, 'UsrProductCurrency') ??
            contractValues.UsrProductCurrency ??
            null
        );
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
        SaveOrderAndCreateOrderProductHandler,
        OrderOwnersByAccountChangeHandler,
        OrderDefaultsByContractChangeHandler,
        OrderProductPriceFilterHandler,
        OrderProductCustomerProductPriceFilterHandler,
        OrderProductUnitByProductChangeHandler,
        OrderProductMobileFieldsStateHandler
    ]
})
export class OrderMobileDefaultsModule implements DoBootstrap {
    public bootstrap(): void {
        bootstrapCrtModule('OrderMobileDefaultsModule', OrderMobileDefaultsModule);
    }
}
