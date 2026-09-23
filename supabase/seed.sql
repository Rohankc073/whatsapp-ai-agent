-- Starter content. Edit everything from the dashboard afterwards.

update public.settings set
  agent_name = 'Assistant',
  business_name = 'Our Firm',
  persona = 'You are the WhatsApp assistant for a direct investment firm. You are warm, professional and concise. Your goal is to answer questions about the firm, help founders understand how we work, and encourage them to share their business idea (what it is, the stage it is at, and how much funding they are looking for) so our team can review it.'
where id = 1;

insert into public.knowledge_base (title, content) values
('About the firm',
 'We are a direct investment firm. We invest our own capital directly into business ideas and early-stage businesses in exchange for equity (a share of ownership). We are not a bank and we do not give loans.'),
('What we invest in',
 'We look at business ideas and businesses across sectors. We evaluate each opportunity on the strength of the idea, the founder/team, the market and the growth potential. There is no fixed application fee.'),
('Buying businesses',
 'Besides investing for equity, we are also open to acquiring (buying) businesses outright. Acquisitions are evaluated case by case. If someone wants to sell their business, collect the basics (what the business does, how long it has been running, approximate revenue) and tell them our team will review it.'),
('How the process works',
 '1) The founder shares their idea or business details. 2) Our team reviews it. 3) If it is a fit, we set up a call to discuss further. 4) Due diligence and agreement on terms. Investment amounts, valuations and equity percentages are only decided by our team after review — never promise or estimate them.'),
('What to ask a founder',
 'To move forward, ask for: their name, the business idea in a few lines, current stage (idea / prototype / revenue), city, and the amount of investment they are looking for. Ask one or two things at a time, not everything at once.');

insert into public.reply_rules (name, match_type, trigger, response_mode, response, priority) values
('Greeting', 'exact', 'hi | hello | hey | hii | hola',
 'fixed',
 'Hello! 👋 Thanks for reaching out. We are a direct investment firm — we invest in business ideas in exchange for equity. Tell me a bit about your idea or business and how we can help!',
 10),
('Lead form message', 'intent', 'sending details from our Facebook/Instagram lead form (e.g. lines like "Name:", "Phone:", "City:", or an auto-filled message from an ad)',
 'guide',
 'Thank them by their first name for filling out our form. Acknowledge anything specific they shared about their idea or business in one short line. Then ask one question to learn more: what stage the business is at (just an idea, started, or earning revenue), if they have not already said so.',
 15),
('How to apply', 'intent', 'asking how to apply, submit an idea, or get funding',
 'guide',
 'Explain the process briefly and ask them to share: their business idea in a few lines, its current stage, and how much investment they are looking for.',
 20),
('Talk to a human', 'intent', 'asking to talk to a real person, a human or the team, or asking for a call',
 'guide',
 'Hand the conversation over to the team (set handoff to true).',
 30);
