-- Add status column to support_leads
alter table support_leads
  add column if not exists status text not null default 'nuevo'
  check (status in ('nuevo', 'contactado', 'en_seguimiento', 'cerrado'));

comment on column support_leads.status is 'Estado del lead: nuevo | contactado | en_seguimiento | cerrado';
