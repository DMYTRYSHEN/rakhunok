begin;
set local lock_timeout = '2s';
set local statement_timeout = '30s';

alter function support_private.snapshot(uuid, uuid) rename to snapshot_summary_v1;
revoke all on function support_private.snapshot_summary_v1(uuid, uuid) from public, anon, authenticated;

create function support_private.snapshot(p_target uuid, p_merchant uuid)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
	response jsonb;
begin
	response := support_private.snapshot_summary_v1(p_target, p_merchant);
	return jsonb_set(response, '{invoices}', coalesce((
		select jsonb_agg(item || jsonb_build_object('detail', jsonb_build_object(
			'shortId', invoice.short_id, 'description', invoice.description,
			'baseAmount', coalesce(invoice.base_amount, 0),
			'discountAmount', coalesce(invoice.discount_amount, 0),
			'deliveryFee', coalesce(invoice.delivery_fee, 0),
			'tableNumber', invoice.table_number, 'terminalId', invoice.terminal_id,
			'terminalCode', terminal.code, 'paidAt', invoice.paid_at,
			'paidBankCode', invoice.paid_bank_code)) order by position)
		from jsonb_array_elements(response -> 'invoices') with ordinality listed(item, position)
		join public.orders invoice on invoice.id = (item ->> 'id')::uuid and invoice.merchant_id = p_merchant
		left join public.terminals terminal on terminal.id = invoice.terminal_id and terminal.user_id = p_target
	), '[]'::jsonb));
end
$$;

revoke all on function support_private.snapshot(uuid, uuid) from public, anon, authenticated;

commit;
