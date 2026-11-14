-- Survey submissions must go through the app server, which PII-scrubs free text and runs the
-- crisis classifier before storing anything. Only the service role may call the insert RPC.
revoke execute on function public.submit_survey_response(text, text, jsonb, text, jsonb, boolean, text, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_survey_response(text, text, jsonb, text, jsonb, boolean, text, boolean)
  to service_role;

-- Placeholder links (e.g. a provider homepage) are flagged so pastors can replace them.
alter table public.resources add column if not exists url_verified boolean not null default true;
