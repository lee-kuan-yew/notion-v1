'use client';
import Link from 'next/link';
import { useTransition } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Account, Category, Project, Transaction } from '@/types/database';
import { saveTransaction } from '@/features/workspace/actions';
import { Field, FormPanel } from '@/components/shared/primitives';
import { SelectDropdown } from '@/components/ui/dropdown';
import { MoneyInput } from '@/components/ui/money-input';

const schema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    amount: z.coerce.number().positive(),
    transaction_date: z.iso.date(),
    account_id: z.string().optional(),
    from_account_id: z.string().optional(),
    to_account_id: z.string().optional(),
    category_id: z.string().optional(),
    project_id: z.string().optional(),
    payee: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'transfer' && (!v.from_account_id || !v.to_account_id || v.from_account_id === v.to_account_id)) {
      ctx.addIssue({ code: 'custom', message: 'Chọn hai tài khoản khác nhau', path: ['to_account_id'] });
    }
    if (v.type !== 'transfer' && (!v.account_id || !v.category_id)) {
      ctx.addIssue({ code: 'custom', message: 'Chọn tài khoản và danh mục', path: ['category_id'] });
    }
  });

type FormValues = z.input<typeof schema>;

export function TransactionForm({
  transaction,
  accounts,
  categories,
  projects,
  today,
  defaultProjectId,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
  projects: Project[];
  today: string;
  defaultProjectId?: string;
}) {
  const [pending, start] = useTransition();
  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    shouldUnregister: true,
    defaultValues: {
      type: transaction?.type ?? 'expense',
      amount: transaction?.amount ?? '',
      transaction_date: transaction?.transaction_date ?? today,
      account_id: transaction?.account_id ?? '',
      from_account_id: transaction?.from_account_id ?? '',
      to_account_id: transaction?.to_account_id ?? '',
      category_id: transaction?.category_id ?? '',
      project_id: transaction?.project_id ?? defaultProjectId ?? '',
      payee: transaction?.payee ?? '',
      description: transaction?.description ?? '',
      notes: transaction?.notes ?? '',
    },
  });

  const type = useWatch({ control, name: 'type' });
  const activeAccounts = accounts.filter(
    a => !a.is_archived || [transaction?.account_id, transaction?.from_account_id, transaction?.to_account_id].includes(a.id)
  );
  const accountOptions = [{ value: '', label: 'Chọn tài khoản' }, ...activeAccounts.map(a => ({ value: a.id, label: a.name }))];
  const categoryOptions = [
    { value: '', label: 'Chọn danh mục' },
    ...categories
      .filter(c => c.kind === type && (!c.is_archived || c.id === transaction?.category_id))
      .map(c => ({ value: c.id, label: c.name })),
  ];
  const projectOptions = [
    { value: '', label: 'Không liên kết' },
    ...projects.filter(p => p.status !== 'archived' || p.id === transaction?.project_id).map(p => ({ value: p.id, label: p.name })),
  ];

  return (
    <FormPanel title={transaction ? 'Sửa giao dịch' : 'Giao dịch mới'}>
      <form
        onSubmit={event => {
          const form = event.currentTarget;
          void handleSubmit(() => {
            start(async () => await saveTransaction(new FormData(form)));
          })(event);
        }}
        className="form-grid"
      >
        <input type="hidden" name="id" value={transaction?.id ?? ''} />
        <Field label="Loại giao dịch" name="type">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <SelectDropdown
                id="type"
                name="type"
                value={field.value}
                onChange={next => {
                  field.onChange(next);
                  setValue('category_id', '');
                  setValue('project_id', '');
                  setValue('account_id', '');
                  setValue('from_account_id', '');
                  setValue('to_account_id', '');
                }}
                options={[
                  { value: 'expense', label: 'Chi tiêu' },
                  { value: 'income', label: 'Thu nhập' },
                  { value: 'transfer', label: 'Chuyển tiền' },
                ]}
              />
            )}
          />
        </Field>
        <Field label="Số tiền" name="amount">
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <MoneyInput
                id="amount"
                name="amount"
                placeholder="100,000"
                value={field.value === undefined || field.value === null ? '' : String(field.value)}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          {errors.amount && <span className="text-xs text-red-600">Số tiền phải lớn hơn 0</span>}
        </Field>
        <Field label="Ngày" name="transaction_date">
          <input id="transaction_date" className="input" type="date" {...register('transaction_date')} />
        </Field>
        {type === 'transfer' ? (
          <>
            <Field label="Tài khoản nguồn" name="from_account_id">
              <Controller
                control={control}
                name="from_account_id"
                render={({ field }) => (
                  <SelectDropdown
                    id="from_account_id"
                    name="from_account_id"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={accountOptions}
                  />
                )}
              />
            </Field>
            <Field label="Tài khoản đích" name="to_account_id">
              <Controller
                control={control}
                name="to_account_id"
                render={({ field }) => (
                  <SelectDropdown
                    id="to_account_id"
                    name="to_account_id"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={accountOptions}
                  />
                )}
              />
              {errors.to_account_id && <span className="text-xs text-red-600">{errors.to_account_id.message}</span>}
            </Field>
          </>
        ) : (
          <>
            <Field label="Tài khoản" name="account_id">
              <Controller
                control={control}
                name="account_id"
                render={({ field }) => (
                  <SelectDropdown
                    id="account_id"
                    name="account_id"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={accountOptions}
                  />
                )}
              />
            </Field>
            <Field label="Danh mục" name="category_id">
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <SelectDropdown
                    id="category_id"
                    name="category_id"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    options={categoryOptions}
                  />
                )}
              />
              {errors.category_id && <span className="text-xs text-red-600">{errors.category_id.message}</span>}
            </Field>
            {type === 'expense' && (
              <Field label="Dự án (tùy chọn)" name="project_id">
                <Controller
                  control={control}
                  name="project_id"
                  render={({ field }) => (
                    <SelectDropdown
                      id="project_id"
                      name="project_id"
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      options={projectOptions}
                    />
                  )}
                />
              </Field>
            )}
          </>
        )}
        <Field label="Đối tác" name="payee">
          <input id="payee" className="input" {...register('payee')} />
        </Field>
        <Field label="Mô tả" name="description">
          <input id="description" className="input" {...register('description')} />
        </Field>
        <Field label="Ghi chú" name="notes" className="col-span-full">
          <textarea id="notes" className="input" rows={2} {...register('notes')} />
        </Field>
        <div className="col-span-full flex items-end gap-2">
          <button disabled={pending} className="btn btn-primary">
            {pending ? 'Đang lưu...' : 'Lưu giao dịch'}
          </button>
          <Link href="/app/finance/transactions" className="btn">
            Hủy
          </Link>
        </div>
      </form>
    </FormPanel>
  );
}
