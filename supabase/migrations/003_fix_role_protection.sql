-- Correctif : permet de promouvoir un admin depuis le SQL Editor / service_role.
-- (Dans le SQL Editor, auth.uid() est NULL : l'ancien trigger annulait le changement.)
-- Les utilisateurs connectés via l'application restent bloqués.

create or replace function protect_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.role is distinct from old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end $$;

create or replace function protect_subscription() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.subscription_status := old.subscription_status;
    new.trial_ends_at := old.trial_ends_at;
    new.subscription_ends_at := old.subscription_ends_at;
    new.is_active := old.is_active;
  end if;
  return new;
end $$;

-- Promouvoir votre compte (remplacez l'email) :
update profiles set role = 'admin'
where id = (select id from auth.users where email = 'VOTRE_EMAIL@exemple.com');

-- Vérification : doit afficher role = admin
select p.id, u.email, p.role from profiles p join auth.users u on u.id = p.id where p.role = 'admin';
