-- =============================================================================
-- Link a login to its person only once the login's email is confirmed.
--
-- Before: a login and a person were linked by matching email alone. If public
-- sign-ups were ever on (a hosted project before docs/SETUP.md B2 is done),
-- someone could sign up with a teammate's address before that person existed,
-- and the unconfirmed login would be linked to the teammate's profile.
-- Now an unconfirmed login is never linked; it is linked when it's confirmed.
-- (Our own logins are created confirmed: pnpm seed and the invite flow.)
-- =============================================================================

-- Person created after the login: link only a confirmed login.
create or replace function app.tg_people_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    -- Link to an existing confirmed login with the same email, if there is one.
    if new.auth_user_id is null then
      select u.id into new.auth_user_id
        from auth.users u
       where lower(u.email) = lower(new.email::text)
         and u.email_confirmed_at is not null
       limit 1;
    end if;
    insert into public.actors (id, kind, display_name, is_active)
    values (new.id, 'person', new.name, new.is_active)
    on conflict (id) do update set display_name = excluded.display_name, is_active = excluded.is_active;
  elsif new.name is distinct from old.name or new.is_active is distinct from old.is_active then
    update public.actors set display_name = new.name, is_active = new.is_active where id = new.id;
  end if;
  return new;
end;
$$;

-- Login created (or confirmed) after the person: link once it's confirmed.
create or replace function app.tg_link_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email_confirmed_at is null then
    return new;
  end if;
  -- Compare lowercased text: with search_path = '' the citext "=" operator
  -- (in schema extensions) isn't found, and a plain text compare is case-sensitive.
  update public.people
     set auth_user_id = new.id
   where lower(email::text) = lower(new.email)
     and auth_user_id is null;
  return new;
end;
$$;

create trigger link_auth_user_to_person_on_confirm
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function app.tg_link_auth_user();
