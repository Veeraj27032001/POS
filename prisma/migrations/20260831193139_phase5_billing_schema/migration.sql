-- CreateEnum
CREATE TYPE "BillType" AS ENUM ('cash_bill', 'credit_bill', 'online_bill');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('draft', 'held', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "BillLineStatus" AS ENUM ('active', 'voided');

-- CreateEnum
CREATE TYPE "PaymentRequestMethod" AS ENUM ('qr_code', 'payment_link', 'card_machine');

-- CreateEnum
CREATE TYPE "PaymentRequestDeliveryChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('pending', 'paid', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "RefundSourceType" AS ENUM ('bill_cancellation', 'bill_return');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "BillStatusAtCancellation" AS ENUM ('draft', 'held', 'completed');

-- CreateEnum
CREATE TYPE "ReturnLineCondition" AS ENUM ('sellable', 'damaged');

-- CreateEnum
CREATE TYPE "CreditNoteSourceType" AS ENUM ('bill_return', 'bill_cancellation');

-- CreateEnum
CREATE TYPE "BillPaymentStatus" AS ENUM ('success', 'failed', 'pending');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "ShiftCashCountType" AS ENUM ('opening', 'closing');

-- CreateTable
CREATE TABLE "bills" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "bill_type" "BillType" NOT NULL,
    "store_id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "cashier_user_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "status" "BillStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "due_date" DATE,
    "receipt_snapshot" JSONB,
    "held_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    "shift_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "bills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_lines" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "product_barcode" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "tax_breakdown" JSONB NOT NULL,
    "discount_applied" DECIMAL(12,2),
    "discount_reason_code_id" TEXT,
    "line_total" DECIMAL(12,2) NOT NULL,
    "status" "BillLineStatus" NOT NULL DEFAULT 'active',
    "voided_by_user_id" TEXT,
    "voided_at" TIMESTAMP(3),

    CONSTRAINT "bill_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_line_warehouse_allocations" (
    "id" TEXT NOT NULL,
    "bill_line_id" TEXT NOT NULL,
    "warehouse_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "bill_line_warehouse_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_requests" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentRequestMethod" NOT NULL,
    "delivery_channel" "PaymentRequestDeliveryChannel",
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'pending',
    "gateway_reference" TEXT,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL,
    "source_type" "RefundSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refund_method_id" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'pending',
    "gateway_reference" TEXT,
    "processed_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_cancellations" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "bill_status_at_cancellation" "BillStatusAtCancellation" NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "reason_code_id" TEXT NOT NULL,
    "cancelled_by_user_id" TEXT NOT NULL,
    "cancelled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_returns" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "reason_code_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "processed_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_return_lines" (
    "id" TEXT NOT NULL,
    "return_id" TEXT NOT NULL,
    "bill_line_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "condition" "ReturnLineCondition" NOT NULL,
    "warehouse_id" TEXT NOT NULL,

    CONSTRAINT "bill_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "source_type" "CreditNoteSourceType" NOT NULL,
    "bill_return_id" TEXT,
    "bill_cancellation_id" TEXT,
    "original_bill_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "tax_breakdown" JSONB NOT NULL,
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_payments" (
    "id" TEXT NOT NULL,
    "bill_id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference_number" TEXT,
    "status" "BillPaymentStatus" NOT NULL DEFAULT 'success',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bill_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "cashier_user_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "financial_year_id" TEXT NOT NULL,
    "status" "ShiftStatus" NOT NULL DEFAULT 'open',
    "opening_float" DECIMAL(12,2) NOT NULL,
    "closing_expected" DECIMAL(12,2),
    "closing_counted" DECIMAL(12,2),
    "variance" DECIMAL(12,2),
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_cash_counts" (
    "id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "denomination_id" TEXT NOT NULL,
    "count_type" "ShiftCashCountType" NOT NULL,
    "quantity_counted" INTEGER NOT NULL,

    CONSTRAINT "shift_cash_counts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_cashier_user_id_fkey" FOREIGN KEY ("cashier_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bills" ADD CONSTRAINT "bills_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_discount_reason_code_id_fkey" FOREIGN KEY ("discount_reason_code_id") REFERENCES "reason_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_line_warehouse_allocations" ADD CONSTRAINT "bill_line_warehouse_allocations_bill_line_id_fkey" FOREIGN KEY ("bill_line_id") REFERENCES "bill_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_line_warehouse_allocations" ADD CONSTRAINT "bill_line_warehouse_allocations_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_requests" ADD CONSTRAINT "payment_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_refund_method_id_fkey" FOREIGN KEY ("refund_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_cancellations" ADD CONSTRAINT "bill_cancellations_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_cancellations" ADD CONSTRAINT "bill_cancellations_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_cancellations" ADD CONSTRAINT "bill_cancellations_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_cancellations" ADD CONSTRAINT "bill_cancellations_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_cancellations" ADD CONSTRAINT "bill_cancellations_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_returns" ADD CONSTRAINT "bill_returns_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_returns" ADD CONSTRAINT "bill_returns_reason_code_id_fkey" FOREIGN KEY ("reason_code_id") REFERENCES "reason_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_returns" ADD CONSTRAINT "bill_returns_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_returns" ADD CONSTRAINT "bill_returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_returns" ADD CONSTRAINT "bill_returns_processed_by_user_id_fkey" FOREIGN KEY ("processed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_return_lines" ADD CONSTRAINT "bill_return_lines_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "bill_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_return_lines" ADD CONSTRAINT "bill_return_lines_bill_line_id_fkey" FOREIGN KEY ("bill_line_id") REFERENCES "bill_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_return_lines" ADD CONSTRAINT "bill_return_lines_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_bill_return_id_fkey" FOREIGN KEY ("bill_return_id") REFERENCES "bill_returns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_bill_cancellation_id_fkey" FOREIGN KEY ("bill_cancellation_id") REFERENCES "bill_cancellations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_original_bill_id_fkey" FOREIGN KEY ("original_bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bill_payments" ADD CONSTRAINT "bill_payments_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_cashier_user_id_fkey" FOREIGN KEY ("cashier_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_financial_year_id_fkey" FOREIGN KEY ("financial_year_id") REFERENCES "financial_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_cash_counts" ADD CONSTRAINT "shift_cash_counts_shift_id_fkey" FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_cash_counts" ADD CONSTRAINT "shift_cash_counts_denomination_id_fkey" FOREIGN KEY ("denomination_id") REFERENCES "cash_denominations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

