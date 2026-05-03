import { IsNotEmpty, IsNumber, IsPositive, IsString, Length } from 'class-validator';

export class ProcessOrderDto {
    @IsString()
    @IsNotEmpty()
    orderId!: string;

    @IsString()
    @IsNotEmpty()
    customerId!: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsPositive()
    total!: number;

    @IsString()
    @Length(3, 3)
    currency!: string;
}

export type ProcessOrderStatus = 'SUCCESS' | 'FAILED' | 'PENDING';

export interface ProcessOrderResponse {
    status: ProcessOrderStatus;
    message: string;
}
