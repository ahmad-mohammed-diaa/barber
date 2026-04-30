import { ApiDoc } from '../../common/lib/swagger';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';

export const CreatePromoCodeDoc = () =>
  ApiDoc({
    summary: 'Create a new promo code',
    body: CreatePromoCodeDto,
    extraModels: [CreatePromoCodeDto],
    auth: true,
  });

export const GetAllPromoCodesDoc = () =>
  ApiDoc({
    summary: 'Get all promo codes',
    auth: true,
  });

export const ValidatePromoCodeDoc = () =>
  ApiDoc({
    summary: 'Validate a promo code',
    auth: true,
  });

export const DeletePromoCodeDoc = () =>
  ApiDoc({
    summary: 'Delete a promo code by ID',
    params: [{ name: 'id', type: 'string' }],
    auth: true,
  });
