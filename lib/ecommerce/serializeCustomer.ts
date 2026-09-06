import type { Customer, EcommerceCustomer } from "@/generated/prisma/client";

// The shape every v1 customer endpoint returns — id is the EcommerceCustomer
// (the external API's own identity), profile fields come from the linked
// Customer record.
export function serializeEcommerceCustomer(
  ecommerceCustomer: EcommerceCustomer,
  customer: Customer,
) {
  return {
    id: ecommerceCustomer.id,
    name: customer.name,
    phone: ecommerceCustomer.phone,
    email: customer.email,
    hasPassword: Boolean(ecommerceCustomer.passwordHash),
  };
}
