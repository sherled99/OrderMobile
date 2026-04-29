# AGENTS.MD

## Project Context

This project contains Creatio Mobile Freedom UI client logic.

Read these files first:

- `src/index.ts` - all request handlers and business logic live here.
- `package.json` - build scripts. Use `npm.cmd run build` on Windows PowerShell.
- `creatio-mobile-config.json` - mobile module/package config.
- `README.md` - project bootstrap notes.
- `webpack.config.js` - output files and build behavior.

Useful local SDK types:

- `node_modules/@creatio/mobile-common/index.d.ts`
- `node_modules/@creatio/base/index.d.ts`

## Build

Use:

```powershell
npm.cmd run build
```

Plain `npm run build` can fail in PowerShell because `npm.ps1` execution is blocked by Windows policy.

Build outputs include:

- `main.debug.js`
- `main.js`
- `out/index.d.ts`

## Current Pages And Fields

Page constants:

- `ORDER_MOBILE_PAGE = 'UsrOrderMobileEditPage'`
- `ORDER_PRODUCT_MOBILE_PAGE = 'UsrOrderProductMobileEditPage'`

Important attributes:

- Order contract: `OrderDS_UsrContract_k0jq8wn`
- Order currency: `OrderDS_Currency_bpgbf8n`
- Order product lookup: `OrderProductDS_Product_hg2hy0q`
- Customer product flag: `UsrCustomerProduct`
- Product lookup business-rule filter attribute: `OrderProductDS_Product_hg2hy0q_List_BusinessRule_Filter`

## Request Handler Rules

Handlers must be decorated with `@CrtRequestHandler` and registered in `@CrtModule({ requestHandlers: [...] })`.

Common request types:

- `crt.LoadDataRequest` - page/list data loading and initial state changes.
- `crt.SaveRecordRequest` - before saving.
- `crt.HandleViewModelAttributeChangeRequest` - react to field changes.

Prefer `debugLog(...)` for mobile logs:

```ts
const debugLog = (...args: unknown[]): void => {
    (globalThis as { console?: { log: (...items: unknown[]) => void } }).console?.log(...args);
};
```

## Editable / Readonly

Use:

```ts
await request.$context.setAttributePropertyValue(attributeName, 'readonly', true);
```

Current behavior:

- On `UsrOrderMobileEditPage`, if `CardState !== 'add'`, account, contract, and close date are readonly.
- On `UsrOrderProductMobileEditPage`, if `CardState !== 'add'`, product is readonly.

Keep readonly logic separate from lookup filtering logic.

## Autocomplete / Autofill

Use `crt.HandleViewModelAttributeChangeRequest` when a value should be recalculated after a field changes.

Pattern:

1. Call `const result = await this.next?.handle(request);`.
2. Check `request.attributeName`.
3. Extract lookup ids robustly. Lookup values can be strings or objects with `value`, `Value`, `id`, or `Id`.
4. Load related records with `Model.create(...).load(...)`.
5. Set target value with `request.$context.setAttribute(attributeName, value)`.
6. Return `result`.

Existing example:

- When order contract changes, currency is loaded through `Contract -> UsrPricelist.UsrProductCurrency`.
- Currency is normalized to `{ value, displayValue }` before setting.

## Lookup Filtering

Important Creatio Mobile rule discovered from Creatio support/PDF:

Do not rely on adding lookup filters to `request.parameters`, and do not set plain `filter` property on the lookup field for this case.

For a lookup field, set the special business-rule filter attribute instead:

```ts
await context.setAttribute(
    '<LookupAttribute>_List_BusinessRule_Filter',
    filterDto
);
```

For product lookup this is:

```ts
OrderProductDS_Product_hg2hy0q_List_BusinessRule_Filter
```

Current product filter:

- If `UsrCustomerProduct = true`: `Price > 0`
- If `UsrCustomerProduct = false`: `Price = 0`

Use a compare filter DTO:

```ts
{
    filterType: FilterType.Compare,
    comparisonType: ComparisonType.Greater, // or ComparisonType.Equal
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
    key: '<stable-guid>'
}
```

## Avoid Infinite Loading

Be very careful setting context attributes inside `crt.LoadDataRequest`.

If a handler calls `setAttribute(...)` on every load, Creatio Mobile can enter a loop:

1. load request fires;
2. handler changes context;
3. page/list reloads;
4. handler fires again.

Always make filter/state updates idempotent:

- Read current context value first with `getAttribute` and direct fallback.
- Compare the current filter with the target filter.
- Keep a module-level last-applied state if the mobile context does not return the value reliably.
- Only call `setAttribute(...)` when the target state actually changed.

Do not use a `WeakSet` keyed by `$context` wrappers for loop prevention here. Creatio Mobile may create a new JS wrapper per request, so `WeakSet` can miss repeated calls.

## Dynamic Filter Updates

For filters that depend on another field:

1. Apply the filter on `crt.LoadDataRequest` so the initial lookup is correct.
2. Add a `crt.HandleViewModelAttributeChangeRequest` handler for the dependency field.
3. Reapply only when the calculated comparison/state changes.

Current dependency:

- Field: `UsrCustomerProduct`
- Handler: `OrderProductCustomerProductPriceFilterHandler`
- Shared helper: `applyOrderProductPriceFilter(...)`

## Useful Helpers

Use robust context reading:

```ts
async function getContextAttributeValue(context, attributeName) {
    try {
        if (typeof context.getAttribute === 'function') {
            const value = await context.getAttribute(attributeName);
            if (value !== undefined) {
                return value;
            }
        }
    } catch {
        // try direct access
    }

    try {
        return await context[attributeName];
    } catch {
        return undefined;
    }
}
```

Use robust boolean conversion:

```ts
function toBoolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1;
}
```

Use robust lookup id extraction:

```ts
value?.value ?? value?.Value ?? value?.id ?? value?.Id
```

## Notes For Future Work

- Before changing field names, inspect the actual page structure. Generated mobile attributes can differ from expected names.
- For lookup business-rule filter names, confirm the exact `<LookupAttribute>_List_BusinessRule_Filter` attribute in the processed page structure if a filter does not apply.
- The warning `BusinessRuleFormulaExpression is not implemented in mobile app` may appear in logs from Creatio business rules; do not assume it comes from this module unless behavior points there.
- Keep changes scoped. Do not reintroduce the old heavy product filtering by account, order type, contract, or pricelist unless explicitly requested.
