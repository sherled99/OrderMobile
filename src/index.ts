import {
    BaseRequest,
    BaseRequestHandler,
    CrtModule,
    CrtRequestHandler,
    DoBootstrap,
    LoadDataRequest,
    Logger,
    bootstrapCrtModule
} from '@creatio/mobile-common';

@CrtRequestHandler({
    requestType: 'crt.LoadDataRequest',
    type: 'glb.OrderMobileFieldsStateHandler',
    scopes: ['UsrOrderMobileEditPage']
})
export class OrderMobileFieldsStateHandler extends BaseRequestHandler<LoadDataRequest> {
    public async handle(request: LoadDataRequest): Promise<unknown> {
        const result = await this.next?.handle(request);
        const cardState = await request.$context['CardState'] as string;

        if (cardState !== 'add') {
            await request.$context.setAttributePropertyValue('OrderDS_Account_5ohaihw', 'readonly', true);
            await request.$context.setAttributePropertyValue('OrderDS_UsrContract_k0jq8wn', 'readonly', true);
            await request.$context.setAttributePropertyValue('OrderDS_UsrCloseDate_g8gnhee', 'readonly', true);
            Logger.console(`[UsrMobile] Account, UsrContract, UsrCloseDate set to readonly for CardState: ${cardState}`);
        }

        return result;
    }
}

@CrtRequestHandler({
    requestType: 'crt.SaveRecordRequest',
    type: 'glb.CustomLoadDataRequestHandler',
    scopes: ['UsrOrderMobileEditPage']
})
export class GlbCustomLoadDataRequestHandler extends BaseRequestHandler {
    public async handle(request: BaseRequest): Promise<unknown> {
        const cardState = await request.$context['CardState'] as string;
        Logger.console(`[UsrMobile] SaveRecordRequest. CardState: ${cardState}`);

        if (cardState === 'add') {
            await request.$context.setAttribute('UsrMobile', true);
            Logger.console('[UsrMobile] UsrMobile set to true');
        }

        return await this.next?.handle(request);
    }
}

@CrtModule({
    requestHandlers: [
        OrderMobileFieldsStateHandler,
        GlbCustomLoadDataRequestHandler
    ]
})
export class OrderMobileDefaultsModule implements DoBootstrap {
    public bootstrap(): void {
        bootstrapCrtModule('OrderMobileDefaultsModule', OrderMobileDefaultsModule);
    }
}
