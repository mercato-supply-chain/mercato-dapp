-- Log account_created and mark invitations converted when profile is attributed at signup.

create or replace function public.after_profile_referral_attribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.referred_by_supplier_id is null then
    return new;
  end if;

  if new.referral_invitation_id is not null then
    update public.supplier_referral_invitations
    set
      status = 'converted',
      converted_profile_id = new.id,
      updated_at = now()
    where id = new.referral_invitation_id
      and status = 'active';

    insert into public.referral_events (
      invitation_id,
      supplier_company_id,
      profile_id,
      event_type
    ) values (
      new.referral_invitation_id,
      new.referred_by_supplier_id,
      new.id,
      'account_created'
    );
  else
    insert into public.referral_events (
      supplier_company_id,
      profile_id,
      event_type
    ) values (
      new.referred_by_supplier_id,
      new.id,
      'account_created'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_referral_attribution_after_insert on public.profiles;
create trigger profiles_referral_attribution_after_insert
  after insert on public.profiles
  for each row
  execute function public.after_profile_referral_attribution();
