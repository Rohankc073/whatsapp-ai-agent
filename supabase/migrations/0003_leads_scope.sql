-- Meta ad leads + "only answer what the agent knows"

-- Where a conversation came from (e.g. a click-to-WhatsApp ad on Facebook/Instagram)
alter table public.conversations add column source text;
alter table public.conversations add column ad_headline text;

-- Reply sent to people who message us from a Meta ad
alter table public.settings add column lead_message text not null default
  'Thank you for filling out our form! 🙏 Our team will review your details and get in touch with you shortly.';

-- When on, the AI only answers what its rules and knowledge cover; everything else is left for the team
alter table public.settings add column strict_scope boolean not null default true;
