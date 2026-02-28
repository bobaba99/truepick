-- Add purchase_motivation column to verdicts table
-- Stores the user's quick-select reason for considering a purchase
-- Values: need_for_work, replacing_old, want_it, gift, health

alter table verdicts
  add column purchase_motivation text
  check (purchase_motivation in ('need_for_work', 'replacing_old', 'want_it', 'gift', 'health'));

comment on column verdicts.purchase_motivation is 'Quick-select motivation chip: why the user wants this purchase';
