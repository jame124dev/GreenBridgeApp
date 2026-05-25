import { z } from 'zod';

export const detailSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  categoryId: z.string().min(1, 'Category is required'),
  condition: z.array(z.string()).min(1, 'Select at least one condition'),
  operationStatus: z.array(z.string()).min(1, 'Select operation status'),
  priceFormat: z.enum(['buyNow', 'offer']),
  pricePerUnit: z.string().optional(),
  priceCurrency: z.enum(['USD', 'TWD']),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  address: z.string().min(1, 'Address is required'),
  country: z.string().min(1, 'Country is required'),
}).superRefine((data, ctx) => {
  if (data.priceFormat === 'buyNow' && !data.pricePerUnit?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'Price is required for buy now',
      path: ['pricePerUnit'],
    });
  }
});

export type DetailFormInput = z.infer<typeof detailSchema>;
